import { Injectable, Logger } from '@nestjs/common';

export interface ExecutorContext {
  tenantId: string;
  proposalId: string;
  actionType: string;
  platform?: string | null;
  payload: Record<string, any>;
}

export interface ExecutorResult {
  ok: boolean;
  externalReference?: string | null;
  responseRedacted?: Record<string, unknown>;
  error?: string;
}

export type ActionHandler = (ctx: ExecutorContext) => Promise<ExecutorResult>;

/**
 * Registry that decouples the Execution Gateway from the modules that actually
 * perform side-effecting actions (e.g. Shopee). Feature modules register a handler
 * for an action type; the gateway looks one up at execution time. This keeps the
 * dependency one-way (marketplace -> compliance) with no circular import.
 */
@Injectable()
export class ActionExecutorRegistry {
  private readonly logger = new Logger(ActionExecutorRegistry.name);
  private readonly handlers = new Map<string, ActionHandler>();

  register(actionType: string, handler: ActionHandler): void {
    if (this.handlers.has(actionType)) {
      this.logger.warn(`Executor for '${actionType}' is being overwritten`);
    }
    this.handlers.set(actionType, handler);
    this.logger.log(`Registered executor for action '${actionType}'`);
  }

  get(actionType: string): ActionHandler | undefined {
    return this.handlers.get(actionType);
  }

  has(actionType: string): boolean {
    return this.handlers.has(actionType);
  }
}
