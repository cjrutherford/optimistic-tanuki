# System Prompt Architecture Analysis & Optimization Plan

## Current State Analysis

### 1. System Prompt Flow Overview

**Current Flow:**
```
Telos Docs Service → AppService → LangGraph/LangChain Services → PromptTemplateService → LLM
```

### 2. Current Issues Identified

#### Issue 1: Dual Prompt Generation Systems
- **Problem**: Two separate systems exist for generating persona prompts:
  1. `libs/prompt-generation/src/lib/personaTelosToPrompt.ts` - Original TELOS-based system
  2. `apps/ai-orchestrator/src/app/prompt-template.service.ts` - New LangChain template system
  
- **Impact**: 
  - Inconsistency in how persona information is presented to LLM
  - `app.service.ts` still uses old `generatePersonaSystemMessage` from prompt-generation library
  - `langchain.service.ts` uses new `formatPersonaTelos` from PromptTemplateService
  - Creates confusion about which is authoritative

#### Issue 2: Persona TELOS Information Fragmentation
- **Old System** (`personaTelosToPrompt.ts` line 37):
  ```typescript
  `You are ${persona.name} who is a(n) ${persona.description}`
  ```
  This causes the LLM to role-play AS the persona (problematic)

- **New System** (`prompt-template.service.ts` line 23):
  ```typescript
  `You are an AI assistant named {personaName}. {personaDescription}`
  ```
  Better, but still not fully leveraging TELOS framework

#### Issue 3: Conversation Not Truly TELOS-Based
- **Current**: Persona TELOS (goals, skills, limitations, core objective) is appended as metadata
- **Problem**: LLM sees TELOS as "capabilities" rather than foundational identity
- **Missing**: The conversation should be driven BY the persona's TELOS, not just informed by it

#### Issue 4: System Prompt Injection Points Are Scattered
Multiple places construct system prompts:
1. `app.service.ts` line 272: Uses old `generatePersonaSystemMessage`
2. `langchain.service.ts` lines 366, 588: Uses `formatPersonaTelos`
3. `langgraph.service.ts`: Passes persona to LangChainService
4. `prompt-template.service.ts`: Defines templates

**Result**: No single source of truth for system prompt construction

#### Issue 5: Profile/Project TELOS Not Integrated
- `libs/prompt-generation` has `generateProfileTelosMessage` and `generateProjectTelosMessage`
- These are NOT used in the new PromptTemplateService
- User TELOS and Project TELOS context is missing from conversations

### 3. Architectural Problems

```
┌─────────────────────────────────────────────────────────────┐
│                     Current Architecture                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Telos Docs Service                                         │
│         │                                                    │
│         ├─→ PersonaTelosDto                                 │
│         ├─→ ProfileTelosDto                                 │
│         └─→ ProjectTelosDto                                 │
│                 │                                            │
│                 ↓                                            │
│  AppService ───────────────────────────────────────────     │
│         │                                                    │
│         ├─→ Uses OLD generatePersonaSystemMessage           │
│         │   (from prompt-generation library)                │
│         │                                                    │
│         └─→ Passes to LangGraph/LangChain                   │
│                     │                                        │
│                     ↓                                        │
│  LangChain/LangGraph Services                               │
│         │                                                    │
│         └─→ Uses NEW formatPersonaTelos                     │
│             (from PromptTemplateService)                    │
│                     │                                        │
│                     ↓                                        │
│  PromptTemplateService                                      │
│         │                                                    │
│         └─→ Creates ChatPromptTemplate                      │
│             with PARTIAL TELOS info                         │
│                                                              │
│  ISSUES:                                                     │
│  ❌ Two separate prompt generation systems                  │
│  ❌ Profile & Project TELOS ignored                         │
│  ❌ Persona TELOS treated as metadata, not identity         │
│  ❌ No single source of truth                               │
└─────────────────────────────────────────────────────────────┘
```

## Optimization Plan

### Phase 1: Consolidate Prompt Generation (CRITICAL)

**Goal**: Single source of truth for all TELOS-based prompt generation

**Actions**:
1. ✅ Keep `PromptTemplateService` as the authoritative prompt builder
2. ✅ Deprecate direct usage of `libs/prompt-generation/personaTelosToPrompt.ts`
3. ✅ Update `PromptTemplateService` to use TELOS framework properly
4. ✅ Remove `generatePersonaSystemMessage` calls from `app.service.ts`

### Phase 2: Implement True TELOS-Driven Conversations

**Goal**: Make persona TELOS the FOUNDATION of the conversation, not just context

**Current Problem**:
```
You are an AI assistant named {personaName}.
{personaDescription}

# YOUR CAPABILITIES AND ROLE
Goals: {personaGoals}
Skills: {personaSkills}
...
```

**Better Approach** (TELOS-First):
```
# PERSONA IDENTITY (TELOS Framework)

You are {personaName}, an AI assistant embodying the following TELOS:

## Purpose & Core Objective
{personaCoreObjective}

## Goals (What you strive to achieve)
{personaGoals}

## Skills (How you accomplish your goals)
{personaSkills}

## Limitations (Your boundaries)
{personaLimitations}

## How You Engage
Your responses should reflect your goals, leverage your skills, respect your limitations,
and always align with your core objective. Every interaction is an opportunity to fulfill
your TELOS.

# USER CONTEXT (Who you're helping)
...
```

### Phase 3: Integrate Profile & Project TELOS

**Goal**: Incorporate user and project TELOS into conversation context

**New Methods Needed**:
```typescript
// In PromptTemplateService
formatProfileTelos(profile: ProfileTelosDto): string
formatProjectTelos(project: ProjectTelosDto): string
```

**Updated System Prompt Structure**:
```
# PERSONA TELOS
[Persona identity as above]

# USER TELOS (The person you're helping)
User: {userName}
User Goals: {userGoals}
User Skills: {userSkills}
User Values: {userValues}

# PROJECT TELOS (Current context, if applicable)
Project: {projectName}
Project Vision: {projectVision}
Project Goals: {projectGoals}
...
```

### Phase 4: Centralize System Prompt Injection

**Goal**: Single injection point for system prompts across all services

**Proposed Architecture**:
```typescript
// New: SystemPromptBuilder class
class SystemPromptBuilder {
  constructor(
    private promptTemplate: PromptTemplateService,
    private telosService: TelosDocsService // Direct access
  ) {}

  async buildSystemPrompt(context: {
    personaId: string;
    profileId: string;
    projectId?: string;
    conversationSummary?: string;
  }): Promise<ChatPromptTemplate> {
    // 1. Fetch all TELOS data
    const persona = await this.fetchPersonaTelos(context.personaId);
    const profile = await this.fetchProfileTelos(context.profileId);
    const project = context.projectId 
      ? await this.fetchProjectTelos(context.projectId)
      : null;

    // 2. Build complete TELOS-driven system prompt
    return this.promptTemplate.createTelosDrivenPrompt({
      persona,
      profile,
      project,
      conversationSummary: context.conversationSummary
    });
  }
}
```

**Usage**:
```typescript
// In app.service.ts, langgraph.service.ts, langchain.service.ts
const systemPrompt = await this.systemPromptBuilder.buildSystemPrompt({
  personaId: persona.id,
  profileId: profile.id,
  projectId: extractedProjectId,
  conversationSummary
});
```

### Phase 5: Update All Services

**Services to Update**:
1. ✅ `app.service.ts` - Remove old `generatePersonaSystemMessage`
2. ✅ `langchain.service.ts` - Use SystemPromptBuilder
3. ✅ `langgraph.service.ts` - Use SystemPromptBuilder
4. ✅ `langchain-agent.service.ts` - Use SystemPromptBuilder
5. ✅ `prompt-template.service.ts` - Add TELOS-driven methods

## Implementation Checklist

### Week 1: Foundation
- [ ] Create `SystemPromptBuilder` service
- [ ] Add `formatProfileTelos` to PromptTemplateService
- [ ] Add `formatProjectTelos` to PromptTemplateService
- [ ] Update `createSystemPromptTemplate` to be TELOS-first
- [ ] Add TELOS-driven prompt template method

### Week 2: Integration
- [ ] Update `app.service.ts` to use SystemPromptBuilder
- [ ] Update `langchain.service.ts` to use SystemPromptBuilder
- [ ] Update `langgraph.service.ts` to use SystemPromptBuilder
- [ ] Update `langchain-agent.service.ts` to use SystemPromptBuilder

### Week 3: Testing & Refinement
- [ ] Add unit tests for SystemPromptBuilder
- [ ] Add integration tests for TELOS-driven conversations
- [ ] Update benchmark script to test TELOS fidelity
- [ ] Performance testing

### Week 4: Migration & Cleanup
- [ ] Deprecate old `generatePersonaSystemMessage` usage
- [ ] Add migration guide for teams
- [ ] Update documentation
- [ ] Monitor conversation quality metrics

## Success Criteria

1. **Single Source of Truth**: All system prompts generated through SystemPromptBuilder
2. **TELOS-Driven**: Persona TELOS is foundational identity, not metadata
3. **Complete Context**: Profile and Project TELOS integrated when available
4. **Consistent Quality**: Benchmark shows improved persona consistency
5. **Clean Architecture**: No duplicate prompt generation logic

## Migration Strategy

### Phase A: Additive (No Breaking Changes)
1. Create SystemPromptBuilder alongside existing code
2. Add new TELOS-driven methods to PromptTemplateService
3. Update services ONE AT A TIME to use new builder
4. Each service update is independently testable

### Phase B: Validation
1. Run A/B tests comparing old vs new prompts
2. Measure conversation quality metrics
3. Validate persona TELOS adherence

### Phase C: Deprecation
1. Mark old methods as @deprecated
2. Add warnings when old methods are used
3. Provide migration path in warnings

### Phase D: Removal (Future)
1. Remove deprecated methods
2. Clean up old prompt-generation library usage
3. Simplify architecture

## Expected Benefits

1. **Consistency**: Single prompt generation path
2. **TELOS Fidelity**: Conversations truly embody persona TELOS
3. **Maintainability**: One place to update prompts
4. **Testability**: Centralized testing of prompt generation
5. **Flexibility**: Easy to add new TELOS dimensions
6. **Performance**: Can cache TELOS data fetching
7. **Quality**: Better persona adherence and user experience

## Risk Mitigation

### Risk 1: Breaking Existing Conversations
**Mitigation**: 
- Feature flag for new system
- A/B testing before full rollout
- Gradual migration service-by-service

### Risk 2: Performance Impact (Additional TELOS Fetching)
**Mitigation**:
- Cache TELOS data in SystemPromptBuilder
- Fetch in parallel where possible
- Profile and optimize

### Risk 3: Prompt Token Length Increase
**Mitigation**:
- Monitor token usage
- Implement smart truncation if needed
- Use summary for long TELOS sections

## Next Steps

1. **Immediate**: Review this plan with team
2. **This Week**: Implement SystemPromptBuilder prototype
3. **Next Week**: Update one service (langchain.service.ts) as proof of concept
4. **Following Week**: Roll out to remaining services
