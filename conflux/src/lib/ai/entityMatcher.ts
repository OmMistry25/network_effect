import type { Person, Organization } from '@/types/domain';

export interface MatchResult {
  type: 'person' | 'organization';
  extractedName: string;
  context: string;
  confidence: number;
  match: {
    type: 'exact' | 'partial' | 'new';
    existingId?: string;
    existingName?: string;
    score: number;
  };
  suggestedAction: 'link' | 'create' | 'review';
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function similarityScore(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  if (aLower === bLower) return 1.0;

  // Check if one contains the other (partial name match)
  if (bLower.includes(aLower) || aLower.includes(bLower)) {
    const shorter = aLower.length < bLower.length ? aLower : bLower;
    const longer = aLower.length < bLower.length ? bLower : aLower;
    return shorter.length / longer.length * 0.9;
  }

  // Levenshtein-based similarity
  const maxLen = Math.max(aLower.length, bLower.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(aLower, bLower);
  return 1 - distance / maxLen;
}

function findBestMatch(
  name: string,
  candidates: { id: string; name: string }[]
): { id: string; name: string; score: number } | null {
  let bestMatch: { id: string; name: string; score: number } | null = null;

  for (const candidate of candidates) {
    const score = similarityScore(name, candidate.name);
    if (score > 0.5 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { ...candidate, score };
    }
  }

  return bestMatch;
}

export function matchEntities(
  extractedEntities: Array<{
    type: 'person' | 'organization' | 'topic';
    name: string;
    context: string;
    confidence: number;
  }>,
  existingPeople: Person[],
  existingOrgs: Organization[]
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const entity of extractedEntities) {
    if (entity.type === 'topic') continue;

    const candidates =
      entity.type === 'person'
        ? existingPeople.map((p) => ({ id: p.id, name: p.full_name }))
        : existingOrgs.map((o) => ({ id: o.id, name: o.name }));

    const bestMatch = findBestMatch(entity.name, candidates);

    let matchResult: MatchResult;

    if (bestMatch && bestMatch.score >= 0.9) {
      // High confidence exact match
      matchResult = {
        type: entity.type,
        extractedName: entity.name,
        context: entity.context,
        confidence: entity.confidence,
        match: {
          type: 'exact',
          existingId: bestMatch.id,
          existingName: bestMatch.name,
          score: bestMatch.score,
        },
        suggestedAction: 'link',
      };
    } else if (bestMatch && bestMatch.score >= 0.6) {
      // Partial match - needs review
      matchResult = {
        type: entity.type,
        extractedName: entity.name,
        context: entity.context,
        confidence: entity.confidence,
        match: {
          type: 'partial',
          existingId: bestMatch.id,
          existingName: bestMatch.name,
          score: bestMatch.score,
        },
        suggestedAction: 'review',
      };
    } else {
      // No match - suggest creating new
      matchResult = {
        type: entity.type,
        extractedName: entity.name,
        context: entity.context,
        confidence: entity.confidence,
        match: {
          type: 'new',
          score: 0,
        },
        suggestedAction: entity.confidence >= 0.7 ? 'create' : 'review',
      };
    }

    results.push(matchResult);
  }

  return results;
}
