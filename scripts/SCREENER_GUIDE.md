# Enhanced Ollama Model Screener - Features

## Overview

The enhanced screener now provides comprehensive testing against **real ai-orchestrator requirements** with detailed metrics, task fitness scoring, and visual graphs.

## Key Features

### 1. Detailed Logging & Progress Tracking

- Real-time progress bars during testing
- Color-coded log levels (info, success, error, warning, debug)
- Verbose mode for detailed debugging
- Automatic log file generation

### 2. Input/Output Token Metrics

- Tracks input tokens, output tokens, and totals
- Calculates tokens per second (in/out/total)
- Helps identify model efficiency

### 3. Task Fitness Scoring

Each model receives:

- **Overall Fitness Score** (0-100): Weighted average across all test suites
- **Category Scores**:
  - Workflow Detection (15%)
  - Tool Call Construction (30%)
  - Self-Correction (20%)
  - Safety & Confirmation (15%)
  - Conversational Quality (20%)
- **Capability Breakdown**: Critical capabilities pass/fail
- **Bang for Buck Score**: Performance vs VRAM efficiency

### 4. Real-World Test Scenarios

Tests actual ai-orchestrator requirements:

- **Workflow Detection**: Classify conversational vs tool_calling vs hybrid
- **Tool Schema Compliance**: Case-sensitive enums, required parameters
- **ID Resolution**: Models must query list_projects before using projectId
- **Self-Correction**: Recovery from validation errors
- **Safety**: Confirmation requests for delete operations
- **Multi-step Reasoning**: Tool chaining capabilities

### 5. Visual Graphs

- **ASCII graphs** in terminal:
  - Token throughput by model
  - Latency comparison
  - Success rates by test suite
- **Interactive HTML graphs** (Chart.js):
  - Bar charts for all metrics
  - Detailed results table
  - Exportable visualization

### 6. More Readable Output

- Section headers with clear visual separators
- Color-coded scores (green/yellow/red)
- ASCII progress bars for quick assessment
- Concise model comparison tables
- Actionable recommendations per model

## Usage Examples

### Basic Screening

```bash
npx tsx scripts/ollama-model-screener.ts --max-vram 8
```

### Full Benchmark with Verbose Logging

```bash
npx tsx scripts/ollama-model-screener.ts --max-vram 8 --benchmark --verbose
```

### Filter by Family and Quantization

```bash
npx tsx scripts/ollama-model-screener.ts --families llama,qwen --quantizations Q4_K_M,Q5_K_M --benchmark
```

### Limit Number of Models

```bash
npx tsx scripts/ollama-model-screener.ts --benchmark --max-models 3
```

## Output Files

1. **JSON Results** (`ollama-screener-results.json`):

   - Complete test results
   - Fitness reports per model
   - Token metrics
   - Recommendations

2. **Log File** (`ollama-screener-results.log`):

   - Detailed execution logs
   - Debug information
   - Error traces

3. **HTML Graphs** (`screener-results.html`):
   - Interactive visualizations
   - Exportable charts
   - Detailed comparison tables

## Task Fitness Scoring Breakdown

### Critical Capabilities Tested

- ✓/✗ **workflow_detection**: Correctly classify user intent
- ✓/✗ **tool_construction**: Build valid MCP tool calls
- ✓/✗ **enum_compliance**: Use case-sensitive enum values
- ✓/✗ **id_resolution**: Query before using IDs
- ✓/✗ **self_correction**: Recover from errors
- ✓/✗ **delete_safety**: Request confirmation for deletes
- ✓/✗ **conversational**: Natural language quality

### Bang for Buck Calculation

```
score = (performance_per_gb × 0.6) + (vr_efficiency × 0.4)
```

Where:

- **performance_per_gb**: Fitness score divided by VRAM (GB)
- **vr_efficiency**: How efficiently the model uses available VRAM

## Understanding Results

### Fitness Score Interpretation

- **90-100**: Excellent - Production ready
- **70-89**: Good - Minor issues, mostly functional
- **50-69**: Fair - Significant gaps, needs attention
- **0-49**: Poor - Not suitable for orchestrator use

### Bang for Buck Interpretation

- **80-100**: Outstanding efficiency
- **60-79**: Good value
- **40-59**: Acceptable
- **0-39**: Consider alternatives

## Recommendations

The screener provides specific recommendations:

- Tool call construction improvements needed
- Self-correction capabilities weak
- Safety compliance issues
- Critical enum case-sensitivity failures
- ID resolution pattern not followed

## Next Steps

1. Run the screener against your available models
2. Review the HTML graphs for visual comparison
3. Focus on models with high "bang for buck" scores
4. Address any critical capability failures
5. Use fitness reports to guide model selection
