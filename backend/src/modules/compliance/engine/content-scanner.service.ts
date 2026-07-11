import { Injectable } from '@nestjs/common';
import { ABSOLUTE_CLAIM_TERMS, PROHIBITED_CONTENT_TERMS } from '../compliance.constants';

export interface ContentScanFinding {
  type: 'absolute_claim' | 'prohibited_content' | 'unverified_claim';
  term: string;
  severity: 'HIGH' | 'CRITICAL';
  message: string;
}

export interface ContentScanResult {
  findings: ContentScanFinding[];
  hasBlocking: boolean;
  hasClaimRequiringEvidence: boolean;
}

/**
 * Deterministic content compliance scanner (XI.A). This is the authoritative
 * layer — an LLM classifier may add signal but can NEVER override a deterministic
 * block (XI.B). Runs before any external publish/marketing action.
 */
@Injectable()
export class ContentScannerService {
  scan(text: string | undefined | null, opts?: { approvedClaimTerms?: string[] }): ContentScanResult {
    const hay = String(text ?? '').toLowerCase();
    const approved = new Set((opts?.approvedClaimTerms ?? []).map((t) => t.toLowerCase()));
    const findings: ContentScanFinding[] = [];

    for (const term of PROHIBITED_CONTENT_TERMS) {
      if (hay.includes(term.toLowerCase())) {
        findings.push({
          type: 'prohibited_content',
          term,
          severity: 'CRITICAL',
          message: `Nội dung chứa yếu tố bị cấm: "${term}"`,
        });
      }
    }

    for (const term of ABSOLUTE_CLAIM_TERMS) {
      const t = term.toLowerCase();
      if (hay.includes(t) && !approved.has(t)) {
        findings.push({
          type: 'absolute_claim',
          term,
          severity: 'HIGH',
          message: `Tuyên bố tuyệt đối cần bằng chứng/được phê duyệt: "${term}"`,
        });
      }
    }

    const hasBlocking = findings.some((f) => f.severity === 'CRITICAL');
    const hasClaimRequiringEvidence = findings.some((f) => f.type === 'absolute_claim');
    return { findings, hasBlocking, hasClaimRequiringEvidence };
  }
}
