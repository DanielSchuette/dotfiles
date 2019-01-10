#!/bin/sh
# install.sh installs dotfiles from this repository
# that need to be in specific locations to work.
# If those files were modified in that location,
# update.sh will synchronize this repository
# automatically.
echo "copying .xinitrc"
cp .xinitrc ~

echo "copying i3.config"
cp i3.config ~/.config/i3/config
