package protocol

import "encoding/json"

type Request struct {
	Command string          `json:"command"`
	Request json.RawMessage `json:"request"`
}

type FenceVideoRequest struct {
	VideoID     string `json:"videoId"`
	OperationID string `json:"operationId"`
	ExpiresAt   int64  `json:"expiresAt"`
	Signature   string `json:"signature"`
}

type DeletionFenceResult struct {
	VideoID        string `json:"videoId"`
	VerifiedAbsent bool   `json:"verifiedAbsent"`
	Fenced         bool   `json:"fenced"`
}

type TranscodeJob struct {
	VideoID    string `json:"videoId"`
	SourcePath string `json:"sourcePath"`
}

type Response struct {
	OK       bool                 `json:"ok"`
	Result   *TranscodeResult     `json:"result,omitempty"`
	Deletion *DeletionFenceResult `json:"deletion,omitempty"`
	Error    string               `json:"error,omitempty"`
}

type TranscodeResult struct {
	PlaybackPath    string   `json:"playbackPath"`
	HLSManifestPath string   `json:"hlsManifestPath"`
	HLSSegmentPaths []string `json:"hlsSegmentPaths"`
	DurationSeconds *int     `json:"durationSeconds,omitempty"`
	Resolution      string   `json:"resolution,omitempty"`
	Encoding        string   `json:"encoding,omitempty"`
}
