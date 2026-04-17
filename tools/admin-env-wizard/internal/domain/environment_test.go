package domain

import (
	"testing"
)

func TestEnvironmentDefinitionValidate(t *testing.T) {
	tests := []struct {
		name    string
		env     EnvironmentDefinition
		wantErr bool
	}{
		{
			name:    "empty name fails",
			env:     EnvironmentDefinition{Name: "", Targets: []Target{TargetCompose}},
			wantErr: true,
		},
		{
			name:    "whitespace only name fails",
			env:     EnvironmentDefinition{Name: "   ", Targets: []Target{TargetCompose}},
			wantErr: true,
		},
		{
			name:    "no targets fails",
			env:     EnvironmentDefinition{Name: "test", Targets: []Target{}},
			wantErr: true,
		},
		{
			name:    "valid compose target",
			env:     EnvironmentDefinition{Name: "test", Targets: []Target{TargetCompose}},
			wantErr: false,
		},
		{
			name:    "valid k8s target",
			env:     EnvironmentDefinition{Name: "test", Targets: []Target{TargetK8s}},
			wantErr: false,
		},
		{
			name:    "both targets valid",
			env:     EnvironmentDefinition{Name: "test", Targets: []Target{TargetCompose, TargetK8s}},
			wantErr: false,
		},
		{
			name:    "invalid compose mode fails",
			env:     EnvironmentDefinition{Name: "test", Targets: []Target{TargetCompose}, ComposeMode: "invalid"},
			wantErr: true,
		},
		{
			name:    "apply compose without compose target fails",
			env:     EnvironmentDefinition{Name: "test", Targets: []Target{TargetK8s}, ApplyCompose: true},
			wantErr: true,
		},
		{
			name:    "apply k8s without k8s target fails",
			env:     EnvironmentDefinition{Name: "test", Targets: []Target{TargetCompose}, ApplyK8s: true},
			wantErr: true,
		},
		{
			name:    "valid apply compose with compose target",
			env:     EnvironmentDefinition{Name: "test", Targets: []Target{TargetCompose}, ApplyCompose: true},
			wantErr: false,
		},
		{
			name:    "valid apply k8s with k8s target",
			env:     EnvironmentDefinition{Name: "test", Targets: []Target{TargetK8s}, ApplyK8s: true},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.env.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestEnvironmentDefinitionNormalize(t *testing.T) {
	tests := []struct {
		name           string
		env            EnvironmentDefinition
		expectedOutput string
		expectedNS     string
		expectedOwner  string
		expectedTag    string
	}{
		{
			name:           "defaults are set",
			env:            EnvironmentDefinition{Name: "test"},
			expectedOutput: "dist/admin-env/test",
			expectedNS:     "optimistic-tanuki",
			expectedOwner:  "cjrutherford",
			expectedTag:    "latest",
		},
		{
			name:           "existing values preserved",
			env:            EnvironmentDefinition{Name: "test", OutputDir: "custom/out", Namespace: "custom-ns", ImageOwner: "custom", DefaultTag: "v1"},
			expectedOutput: "custom/out",
			expectedNS:     "custom-ns",
			expectedOwner:  "custom",
			expectedTag:    "v1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.env.Normalize()
			if tt.env.OutputDir != tt.expectedOutput {
				t.Errorf("OutputDir = %v, want %v", tt.env.OutputDir, tt.expectedOutput)
			}
			if tt.env.Namespace != tt.expectedNS {
				t.Errorf("Namespace = %v, want %v", tt.env.Namespace, tt.expectedNS)
			}
			if tt.env.ImageOwner != tt.expectedOwner {
				t.Errorf("ImageOwner = %v, want %v", tt.env.ImageOwner, tt.expectedOwner)
			}
			if tt.env.DefaultTag != tt.expectedTag {
				t.Errorf("DefaultTag = %v, want %v", tt.env.DefaultTag, tt.expectedTag)
			}
		})
	}
}
