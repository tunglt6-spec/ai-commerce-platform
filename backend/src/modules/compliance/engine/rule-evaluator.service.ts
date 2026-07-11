import { Injectable } from '@nestjs/common';

/**
 * Safe, typed rule evaluator. Rule conditions are stored as a restricted JSON
 * DSL in the database and evaluated WITHOUT eval/Function/dynamic code (XIX,
 * V.2). Unknown operators fail-closed to `false` (no accidental ALLOW).
 *
 * Condition grammar:
 *   { "op": "and" | "or", "rules": [Condition, ...] }
 *   { "op": "not", "rule": Condition }
 *   { "op": "eq"|"ne"|"gt"|"gte"|"lt"|"lte", "field": "path", "value": any }
 *   { "op": "in"|"nin", "field": "path", "value": [..] }
 *   { "op": "exists"|"missing", "field": "path" }
 *   { "op": "contains_any"|"contains_none", "field": "path", "value": ["term"] }
 *   { "op": "truthy"|"falsy", "field": "path" }
 *   { "op": "always" } | { "op": "never" }
 */
export type RuleCondition = Record<string, any>;

@Injectable()
export class RuleEvaluatorService {
  /** Read a dotted path from the context object. */
  private read(ctx: unknown, path: string): unknown {
    if (!path) return undefined;
    return path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, ctx);
  }

  private asArray(v: unknown): unknown[] {
    if (Array.isArray(v)) return v;
    if (v === undefined || v === null) return [];
    return [v];
  }

  private lc(v: unknown): string {
    return String(v ?? '').toLowerCase();
  }

  evaluate(condition: RuleCondition | null | undefined, ctx: unknown): boolean {
    if (!condition || typeof condition !== 'object') return false; // fail-closed
    const op = String(condition.op ?? '').toLowerCase();

    switch (op) {
      case 'always':
        return true;
      case 'never':
        return false;
      case 'and':
        return this.asArray(condition.rules).every((r) => this.evaluate(r as RuleCondition, ctx));
      case 'or':
        return this.asArray(condition.rules).some((r) => this.evaluate(r as RuleCondition, ctx));
      case 'not':
        return !this.evaluate(condition.rule as RuleCondition, ctx);
      case 'exists':
        return this.read(ctx, condition.field) !== undefined && this.read(ctx, condition.field) !== null;
      case 'missing': {
        const v = this.read(ctx, condition.field);
        return v === undefined || v === null;
      }
      case 'truthy':
        return !!this.read(ctx, condition.field);
      case 'falsy':
        return !this.read(ctx, condition.field);
      case 'eq':
        return this.read(ctx, condition.field) === condition.value;
      case 'ne':
        return this.read(ctx, condition.field) !== condition.value;
      case 'gt':
        return Number(this.read(ctx, condition.field)) > Number(condition.value);
      case 'gte':
        return Number(this.read(ctx, condition.field)) >= Number(condition.value);
      case 'lt':
        return Number(this.read(ctx, condition.field)) < Number(condition.value);
      case 'lte':
        return Number(this.read(ctx, condition.field)) <= Number(condition.value);
      case 'in':
        return this.asArray(condition.value).includes(this.read(ctx, condition.field));
      case 'nin':
        return !this.asArray(condition.value).includes(this.read(ctx, condition.field));
      case 'contains_any': {
        const hay = this.lc(this.read(ctx, condition.field));
        return this.asArray(condition.value).some((t) => hay.includes(this.lc(t)));
      }
      case 'contains_none': {
        const hay = this.lc(this.read(ctx, condition.field));
        return !this.asArray(condition.value).some((t) => hay.includes(this.lc(t)));
      }
      default:
        return false; // unknown operator -> fail-closed
    }
  }
}
