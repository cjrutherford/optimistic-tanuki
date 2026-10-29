# Daylight local review schedule

The development Compose stack mounts the checked-in Georgia locality fixtures
as a read-only review registry for Adel, Nashville, and Tifton. They are review
inputs, not a production source-quality or coverage claim. The service checks
for due work every ten minutes. An established town is scheduled at 05:30 in
its own timezone; it runs daily when enough recent material is available and
otherwise on Monday. A town without a previous edition is eligible immediately.

Override `PIPELINE_DAILY_AT`, `PIPELINE_WEEKLY_ON`, and `PIPELINE_TICK_MS` in
the development environment as needed. `CIVIC_LOCALITIES_DIR` can point to a
different registry mounted in both Daylight containers. A valid source registry,
network access, ClamAV, and a working configured model are needed to produce
an edition; enabling the schedule does not guarantee publication. Review source
quality and deployment settings separately before production use.
