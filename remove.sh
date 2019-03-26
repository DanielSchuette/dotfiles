#!/bin/sh
# remove.sh removes config files that were
# installed with $./install.sh.
echo "removing .xinitrc"
rm ~/.xinitrc

echo "removing i3.config"
rm ~/.config/i3/config
