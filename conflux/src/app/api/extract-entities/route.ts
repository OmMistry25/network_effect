import { NextResponse } from 'next/server';
import { openai } from '@/lib/ai/openai';

export interface ExtractedEntity {
  type: 'person' | 'organization' | 'topic';
  name: string;
  context: string;
  confidence: number;
  alternativeNames?: string[];
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  summary: string;
}

const EXTRACTION_PROMPT = `You are an entity extraction system for a professional network/CRM application.

Analyze the following meeting notes or conversation transcript and extract:
1. **People** - Names of individuals mentioned (including partial names like "John" or nicknames)
2. **Organizations** - Companies, institutions, or groups mentioned
3. **Topics** - Key discussion topics or themes

For each entity, provide:
- type: "person", "organization", or "topic"
- name: The name as mentioned (preserve original form)
- context: A brief phrase explaining their role/relevance in this context
- confidence: 0.0-1.0 score for how confident you are this is a real entity (not a common word)
- alternativeNames: For people, include possible full name variations if only a first name is given

Also generate a 1-2 sentence summary of the interaction.

IMPORTANT RULES:
- For partial names (e.g., "John"), set confidence lower (0.5-0.7) and suggest possible full names
- For full names or clear entities, set confidence higher (0.8-1.0)
- Ignore generic terms that aren't specific entities
- Include role/title information in context if mentioned

Respond ONLY with valid JSON in this format:
{
  "entities": [
    {
      "type": "person",
      "name": "John",
      "context": "discussed the Q4 roadmap",
      "confidence": 0.6,
      "alternativeNames": ["John Smith", "John Doe"]
    }
  ],
  "summary": "Brief summary of the interaction"
}`;

export async function POST(request: Request) {
  try {
    const { text, existingPeople, existingOrgs } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const contextPrompt = `
${EXTRACTION_PROMPT}

${existingPeople?.length ? `KNOWN PEOPLE IN SYSTEM (use for matching partial names):
${existingPeople.map((p: { full_name: string; title?: string }) => `- ${p.full_name}${p.title ? ` (${p.title})` : ''}`).join('\n')}` : ''}

${existingOrgs?.length ? `KNOWN ORGANIZATIONS IN SYSTEM:
${existingOrgs.map((o: { name: string }) => `- ${o.name}`).join('\n')}` : ''}

TEXT TO ANALYZE:
${text}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: contextPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const result: ExtractionResult = JSON.parse(content);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Entity extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract entities' },
      { status: 500 }
    );
  }
}
