# .bashrc

# Source global definitions
if [ -f /etc/bashrc ]; then
	. /etc/bashrc
fi

# PS1 prompt; always escape colors with \[...\]
export PS1='[\[\033[0;36m\]\u@\h \[\e[4m\]\[\e[91m\]\W\[\033[0;32m\]\[\033[0m\033[0;32m\]$(declare -F __git_ps1 &>/dev/null && __git_ps1 " (%s)")\[\033[0m\]] 🠞 '
# ▶
# 🠊

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
