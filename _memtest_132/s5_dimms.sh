#!/bin/bash
# Full per-DIMM inventory incl. serial numbers
echo netweb | sudo -S -p '' dmidecode -t 17 2>/dev/null | grep -E '^\s+(Size|Locator|Bank Locator|Manufacturer|Serial Number|Part Number|Speed|Configured Memory Speed|Rank|Total Width|Data Width|Type:|Type Detail)' | grep -v 'No Module Installed' | sed 's/^\s*//'
