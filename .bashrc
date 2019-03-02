# .bashrc
# Source global definitions
if [ -f /etc/bashrc ]; then
	. /etc/bashrc
fi

# enable vi mode and set EDITOR to vim
set -o vi
export EDITOR="vimx"

# enable inline expansion of cmds like `!!' when hitting <space>
# typing `![beginning_of_cmd]' expands according to matching patterns,
# e.g. `!echo' expands to the last `echo' that was run
bind Space:magic-space

# PS1 prompt; always escape colors with \[...\]
# also, urxvt with screen-256color is strange!
# other icons I like: ▶, 🠊
if [ "$TERM" == "screen-256color" ]; then
    export PS1=' $ '
elif [ "$TERM" == "rxvt-unicode-256color" ]; then
    export PS1='[\[\033[0;36m\]\u@\h \[\e[4m\]\[\e[91m\]\W\[\033[0;32m\]\[\033[0m\033[0;32m\]$(declare -F __git_ps1 &>/dev/null && __git_ps1 " (%s)")\[\033[0m\]] $ '
else
    # gnome terminal works well with icons that urxvt cannot handle
    export PS1='[\[\033[0;36m\]\u@\h \[\e[4m\]\[\e[91m\]\W\[\033[0;32m\]\[\033[0m\033[0;32m\]$(declare -F __git_ps1 &>/dev/null && __git_ps1 " (%s)")\[\033[0m\]] 🠞 '
fi

# extra settings for git
source /usr/share/git-core/contrib/completion/git-prompt.sh
export GIT_PS1_SHOWDIRTYSTATE=true
export GIT_PS1_SHOWDIRTYSTATE=true
export GIT_PS1_SHOWUNTRACKEDFILES=true

# User specific environment
PATH="$HOME/.local/bin:$HOME/bin:$PATH"
export PATH

# Uncomment the following line if you don't like
# systemctl's auto-paging feature:
#export SYSTEMD_PAGER=

# User specific aliases and functions
# set environment variables for go
GOBIN="$HOME/code/go_src/bin"
export GOBIN
GOPATH="$HOME/code/go_src"
export GOPATH
GOROOT="" # needs to be set if go is in custom location
export GOROOT
PATH="$HOME/code/go_src/bin:$PATH"
export PATH

# enable experimental support for modules
# (to still respect $GOPATH, set to 'auto')
GO111MODULE="on"
export GO111MODULE

# alias for installing tools outsite packages
# required to install go binaries that are not
# dependencies of a go module
alias oldgoget="GO111MODULE=off go get"

# set environment variables for rust
RUST_SRC_PATH="$(rustc --print sysroot)/lib/rustlib/src/rust/src"
export RUST_SRC_PATH

# create some vim aliases to always use vim-x11
alias v="vimx"
alias vi="vimx"
alias vim="vimx"

# create an alias for ranger
alias r="ranger"

# create an alias for mupdf
alias m="mupdf"

# create an alias for clear
alias c="clear"

# create aliases for faster navigation
alias h="cd ~"
alias co="cd ~/code"
alias dc="cd ~/Documents" # can't use keyword `do' here!
alias dw="cd ~/Downloads"

# a few rust utilities
alias l="exa -lah"
alias ls="exa"
alias t="tokei"

# run MonoDevelop more easily
alias monodevelop="flatpak run com.xamarin.MonoDevelop"

# prevent ranger from loading rc.conf from
# /usr/share/doc/config/ and ~/.config/ranger
export RANGER_LOAD_DEFAULT_RC=FALSE

# useful when configuring .Xresources
alias xup="xrdb ~/dotfiles/.Xresources"

# open thunderbird more easily
alias bird="thunderbird &"

# open rider more easily
alias rider="sh ~/code/sim/JetBrains\ Rider-2018.3.2/bin/rider.sh &"
export TERM=xterm # looks like rider requires this

# resource ~/.bashrc more easily
alias src="source ~/.bashrc && echo 'sourced .bashrc'"
