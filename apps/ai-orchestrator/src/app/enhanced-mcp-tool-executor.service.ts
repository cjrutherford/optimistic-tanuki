import { Injectable, Logger } from '@nestjs/common';
import { ToolValidationService, ToolCallResult } from './tool-validation.service';
import { MCPToolExecutor } from './mcp-tool-executor';

interface ToolCallOptions {
    maxRetries?: number;
    retryDelay?: number;
    conversationId?: string;
}

type ToolParameters = Record<string, unknown>;

@Injectable()
export class EnhancedMCPToolExecutor {
    private readonly logger = new Logger(EnhancedMCPToolExecutor.name);
    private readonly DEFAULT_MAX_RETRIES = 3;
    private readonly DEFAULT_RETRY_DELAY = 1000; // 1 second

    constructor(
        private readonly toolValidation: ToolValidationService,
        private readonly mcpExecutor: MCPToolExecutor
    ) { }

    /**
     * Execute a tool with intelligent validation and retry logic
     */
    async executeToolWithRetry(
        toolName: string,
        parameters: ToolParameters,
        options: ToolCallOptions = {}
    ): Promise<ToolCallResult> {
        const maxRetries = options.maxRetries ?? this.DEFAULT_MAX_RETRIES;
        const retryDelay = options.retryDelay ?? this.DEFAULT_RETRY_DELAY;
        const conversationId = options.conversationId;

        this.logger.log(`Executing tool: ${toolName} with parameters:`, parameters);

        // First, validate the parameters
        const validation = this.toolValidation.validateToolCall(toolName, parameters);
        if (!validation.isValid) {
            const errorMessage = `Tool validation failed: ${validation.errors.join(', ')}`;
            this.logger.warn(errorMessage);

            // Emit tool validation error if conversation ID provided
            if (conversationId) {
                this.emitToolCallUpdate(conversationId, toolName, 'error', errorMessage);
            }

            return {
                success: false,
                error: errorMessage,
                retryable: validation.retryableErrors && validation.retryableErrors.length > 0,
                suggestedFix: validation.suggestions?.join(' ') || this.toolValidation.generateToolHelpMessage(toolName)
            };
        }

        // Parameters are valid, attempt execution
        let attempt = 1;
        let lastError = '';

        while (attempt <= maxRetries) {
            try {
                this.logger.debug(`Tool call attempt ${attempt}/${maxRetries}`);

                // Emit tool call status
                if (conversationId) {
                    if (attempt === 1) {
                        this.emitToolCallUpdate(conversationId, toolName, 'calling');
                    } else {
                        this.emitToolCallUpdate(conversationId, toolName, 'retrying', undefined, attempt);
                    }
                }

                const result = await this.executeTool(toolName, parameters);

                // Success!
                this.logger.log(`Tool ${toolName} executed successfully on attempt ${attempt}`);
                if (conversationId) {
                    this.emitToolCallUpdate(conversationId, toolName, 'success');
                }

                return {
                    success: true,
                    result
                };

            } catch (error) {
                lastError = error.message || 'Unknown error';
                this.logger.warn(`Tool ${toolName} failed on attempt ${attempt}: ${lastError}`);

                // Analyze the error to determine if it's retryable
                const errorAnalysis = this.toolValidation.analyzeToolCallError(toolName, parameters, lastError);

                if (!errorAnalysis.retryable || attempt >= maxRetries) {
                    // Either not retryable or max retries reached
                    if (conversationId) {
                        this.emitToolCallUpdate(conversationId, toolName, 'error', lastError, attempt);
                    }

                    return {
                        success: false,
                        error: lastError,
                        retryable: errorAnalysis.retryable && attempt < maxRetries,
                        suggestedFix: errorAnalysis.suggestedFix
                    };
                }

                // Wait before retry
                if (attempt < maxRetries) {
                    this.logger.debug(`Waiting ${retryDelay}ms before retry...`);
                    await this.sleep(retryDelay);
                }

                attempt++;
            }
        }

        // Should never reach here, but just in case
        return {
            success: false,
            error: lastError,
            retryable: false,
            suggestedFix: 'Maximum retries exceeded'
        };
    }

    /**
     * Execute tool with intelligent error handling and suggestions for fixing issues
     */
    async executeToolWithGuidance(
        toolName: string,
        parameters: ToolParameters,
        conversationId?: string
    ): Promise<{ result?: unknown; error?: string; guidance?: string }> {
        const toolResult = await this.executeToolWithRetry(toolName, parameters, { conversationId });

        if (toolResult.success) {
            return { result: toolResult.result };
        } else {
            // Generate helpful guidance for the AI
            let guidance = toolResult.suggestedFix || 'Tool call failed.';

            if (toolResult.retryable) {
                guidance += ' This error might be temporary - consider retrying with the same parameters.';
            } else {
                guidance += ' Please check your parameters and try again.';

                // Add specific parameter guidance
                const helpMessage = this.toolValidation.generateToolHelpMessage(toolName);
                guidance += `\n\n${helpMessage}`;
            }

            return {
                error: toolResult.error,
                guidance
            };
        }
    }

    /**
     * Execute the actual tool (delegates to MCP executor)
     */
    private async executeTool(toolName: string, parameters: ToolParameters): Promise<unknown> {
        // Check if the MCP executor has the requested tool method
        const toolMethod = (this.mcpExecutor as unknown as Record<string, unknown>)[toolName];

        if (typeof toolMethod === 'function') {
            return await (toolMethod as (...args: unknown[]) => Promise<unknown>).call(this.mcpExecutor, parameters);
        }

        // Fallback: check for common method patterns
        const commonMethods = [
            toolName,
            `execute${toolName.charAt(0).toUpperCase() + toolName.slice(1)}`,
            `call${toolName.charAt(0).toUpperCase() + toolName.slice(1)}`
        ];

        for (const methodName of commonMethods) {
            const method = (this.mcpExecutor as unknown as Record<string, unknown>)[methodName];
            if (typeof method === 'function') {
                return await (method as (...args: unknown[]) => Promise<unknown>).call(this.mcpExecutor, parameters);
            }
        }

        throw new Error(`Unknown tool: ${toolName}. Available methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(this.mcpExecutor)).filter(name => typeof (this.mcpExecutor as unknown as unknown as Record<string, unknown>)[name] === 'function').join(', ')}`);
    }

    /**
     * Generate a self-correction prompt for the AI when tool calls fail
     */
    generateSelfCorrectionPrompt(
        toolName: string,
        parameters: ToolParameters,
        error: string,
        attempt: number
    ): string {
        const validation = this.toolValidation.validateToolCall(toolName, parameters);
        let prompt = `The ${toolName} tool call failed with error: "${error}"\n\n`;

        if (!validation.isValid) {
            prompt += 'Parameter validation errors:\n';
            validation.errors.forEach((err, index) => {
                prompt += `${index + 1}. ${err}\n`;
                if (validation.suggestions && validation.suggestions[index]) {
                    prompt += `   Suggestion: ${validation.suggestions[index]}\n`;
                }
            });
            prompt += '\n';
        }

        const analysis = this.toolValidation.analyzeToolCallError(toolName, parameters, error);
        if (analysis.suggestedFix) {
            prompt += `Suggested fix: ${analysis.suggestedFix}\n\n`;
        }

        if (attempt < this.DEFAULT_MAX_RETRIES && analysis.retryable) {
            prompt += `This error appears to be retryable. Please review the parameters and try again.\n\n`;
        } else {
            prompt += `Please ask the user for clarification if you need additional information to correct the parameters.\n\n`;
        }

        // Add tool help
        prompt += this.toolValidation.generateToolHelpMessage(toolName);

        return prompt;
    }

    /**
     * Emit tool call updates for UI feedback (would integrate with WebSocket gateway)
     */
    private emitToolCallUpdate(
        conversationId: string,
        toolName: string,
        status: 'calling' | 'success' | 'error' | 'retrying',
        error?: string,
        attempt?: number
    ) {
        // In a real implementation, this would emit to the WebSocket gateway
        this.logger.debug(`Tool call update [${conversationId}]: ${toolName} - ${status}`, {
            error,
            attempt
        });

        // TODO: Emit to gateway for real-time UI updates
        // this.gateway.emit('tool_call_update', {
        //   conversationId,
        //   toolName,
        //   status,
        //   error,
        //   attempt
        // });
    }

    /**
     * Sleep utility for retry delays
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Validate and prepare tool parameters with AI-friendly error messages
     */
    validateAndPrepareParameters(toolName: string, parameters: ToolParameters): { valid: boolean; message?: string; parameters?: ToolParameters } {
        const validation = this.toolValidation.validateToolCall(toolName, parameters);

        if (validation.isValid) {
            return { valid: true, parameters };
        }

        const errorMessage = `Tool ${toolName} validation failed:\n` +
            validation.errors.map((error, index) => {
                const suggestion = validation.suggestions?.[index];
                return `• ${error}${suggestion ? ` (${suggestion})` : ''}`;
            }).join('\n');

        return {
            valid: false,
            message: errorMessage + `\n\n${this.toolValidation.generateToolHelpMessage(toolName)}`
        };
    }
}