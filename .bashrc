# .bashrc

# Source global definitions
if [ -f /etc/bashrc ]; then
	. /etc/bashrc
fi

# PS1 prompt; always escape colors with \[...\]
# also, urxvt with screen-256color is strange!
if [ $TERM == "screen-256color" ]; then
    export PS1=' $ '
elif [ $TERM == "rxvt-unicode-256color" ]; then
    export PS1='[\[\033[0;36m\]\u@\h \[\e[4m\]\[\e[91m\]\W\[\033[0;32m\]\[\033[0m\033[0;32m\]$(declare -F __git_ps1 &>/dev/null && __git_ps1 " (%s)")\[\033[0m\]] $ '
else # gnome terminal works well with icons that urxvt cannot handle
    export PS1='[\[\033[0;36m\]\u@\h \[\e[4m\]\[\e[91m\]\W\[\033[0;32m\]\[\033[0m\033[0;32m\]$(declare -F __git_ps1 &>/dev/null && __git_ps1 " (%s)")\[\033[0m\]] 🠞 '
# ▶
# 🠊
fi

# extra settings for git
source /usr/share/git-core/contrib/completion/git-prompt.sh
export GIT_PS1_SHOWDIRTYSTATE=true
export GIT_PS1_SHOWDIRTYSTATE=true
export GIT_PS1_SHOWUNTRACKEDFILES=true

# User specific environment
PATH="$HOME/.local/bin:$HOME/bin:$PATH"
export PATH

# Uncomment the following line if you don't like systemctl's auto-paging feature:
# export SYSTEMD_PAGER=

# User specific aliases and functions
# set environment variables for go
GOBIN="$HOME/code/go_src/bin"
export GOBIN
GOPATH="$HOME/code/go_src"
export GOPATH
PATH="$HOME/code/go_src/bin:$PATH"
export PATH

# enable vi mode
set -o vi

# create some vim aliases to always use vim-x11
alias v="vimx"
alias vi="vimx"
alias vim="vimx"

# create an alias for mupdf
alias m="mupdf"

# create an alias for clear
alias c="clear"

# a few rust utilities
alias l="exa -lah"
alias ls="exa"
alias t="tokei"

# run MonoDevelop more easily
alias monodevelop="flatpak run com.xamarin.MonoDevelop"

# prevent ranger from loading rc.conf from
# /usr/share/doc/config/ and ~/.config/ranger
RANGER_LOAD_DEFAULT_RC=FALSE

# useful when configuring .Xresources
alias xup="xrdb ~/dotfiles/.Xresources"
