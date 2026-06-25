#!/bin/bash

# Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (use sudo)."
  exit 1
fi

echo "=========================================="
echo " Starting Ubuntu Log Cleanup"
echo "=========================================="

# 1. Vacuum systemd journal logs to 3 days
echo "--> Vacuuming journalctl logs to 3 days..."
journalctl --vacuum-time=3d

# 2. Vacuum systemd journal logs to a max size of 500M (optional fallback)
echo "--> Limiting journalctl logs to 500MB..."
journalctl --vacuum-size=500M

# 3. Rotate and archive current logs using logrotate
echo "--> Triggering logrotate..."
logrotate -f /etc/logrotate.conf 2>/dev/null

# 4. Truncate (empty) rotated/gzipped historical log files to free space instantly
echo "--> Cleaning up old rotated (.gz) log files..."
find /var/log -type f -name "*.gz" -delete
find /var/log -type f -name "*.1" -delete

# 5. Clear any massive remaining text logs without deleting the files
echo "--> Truncating heavy text logs..."
for log_file in $(find /var/log -type f -name "*.log"); do
    cat /dev/null > "$log_file"
done

echo "=========================================="
echo " Cleanup complete! Current /var/log size:"
du -sh /var/log
echo "=========================================="
