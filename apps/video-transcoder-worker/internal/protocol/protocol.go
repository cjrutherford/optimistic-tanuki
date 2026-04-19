package protocol

type Request struct {
	Command string       `json:"command"`
	Request TranscodeJob `json:"request"`
}

type TranscodeJob struct {
	VideoID    string `json:"videoId"`
	SourcePath string `json:"sourcePath"`
}

type Response struct {
	OK     bool             `json:"ok"`
	Result *TranscodeResult `json:"result,omitempty"`
	Error  string           `json:"error,omitempty"`
}

type TranscodeResult struct {
	PlaybackPath    string   `json:"playbackPath"`
	HLSManifestPath string   `json:"hlsManifestPath"`
	HLSSegmentPaths []string `json:"hlsSegmentPaths"`
	DurationSeconds *int     `json:"durationSeconds,omitempty"`
	Resolution      string   `json:"resolution,omitempty"`
	Encoding        string   `json:"encoding,omitempty"`
}
