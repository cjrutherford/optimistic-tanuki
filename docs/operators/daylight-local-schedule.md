# Daylight local review schedule

civic-briefing builds its towns from the communities seeded in social: it syncs
them into its own database, renders a registry from that, and schedules every
city and town. No locality files are mounted or shipped. Source quality for a
town is whatever discovery has found; it is not a production coverage claim.
The service checks
for due work every ten minutes. An established town is scheduled at 05:30 in
its own timezone; it runs daily when enough recent material is available and
otherwise on Monday. A town without a previous edition is eligible immediately.

Override `PIPELINE_DAILY_AT`, `PIPELINE_WEEKLY_ON`, and `PIPELINE_TICK_MS` in
the development environment as needed. `DAYLIGHT_SCHEDULE_ENABLED=false`
turns the schedule off, and `SOCIAL_HOST`/`SOCIAL_PORT` point the sync at social.
civic-contributions reads the towns from civic-briefing over TCP. A valid source registry,
network access, ClamAV, and a working configured model are needed to produce
an edition; enabling the schedule does not guarantee publication. Review source
quality and deployment settings separately before production use.
