#!/bin/sh
# update.sh updates config files that are not
# load from this folder but other file system
# locations (like i3.config and .xinitrc).
# They are the same files that can be installed
# using install.sh
echo "updating .xinitrc"
cp ~/.xinitrc ./.xinitrc

echo "updating i3.config"
cp ~/.config/i3/config i3.config
