# This file is sourced by `~/.bashrc'.
#-------------------#
#- General Configs -#
#-------------------#
# Source global definitions
if [ -f /etc/bashrc ]; then
	. /etc/bashrc
fi

# enable vi mode and set EDITOR to vim
set -o vi
export EDITOR="nvim"
export PAGER="most"

# enable inline expansion of cmds like `!!' when hitting <space>
# typing `![beginning_of_cmd]' expands according to matching patterns,
# e.g. `!echo' expands to the last `echo' that was run
bind Space:magic-space

#------------------#
#- PS1/PS2 Config -#
#------------------#
# PS1 prompt
# always escape colors with \[...\]
# also, urxvt with screen-256color is strange!
if [ "$TERM" == "screen-256color" ]; then
    export PS1=' $ '
elif [ "$TERM" == "rxvt-unicode-256color" ]; then
    export PS1='[\[\033[0;36m\]\u@\h \[\e[4m\]\[\e[91m\]\W\[\033[0;32m\]\[\033[0m\033[0;32m\]$(declare -F __git_ps1 &>/dev/null && __git_ps1 " (%s)")\[\033[0m\]] $ '
else
    # gnome terminal works well with icons that urxvt cannot handle
    export PS1='\[\033[0m\033[0;32m\]$(declare -F __git_ps1 &>/dev/null && __git_ps1 "(%s)") $ \[\033[0m\]'
fi

# PS2 prompt
export PS2='\[\e[91m\]   >>\[\033[0m\] '

# extra settings for git-part of prompt
# source /usr/share/git-core/contrib/completion/git-prompt.sh
source $HOME/dotfiles/git-prompt.sh
export GIT_PS1_SHOWDIRTYSTATE=true
export GIT_PS1_SHOWDIRTYSTATE=true
export GIT_PS1_SHOWUNTRACKEDFILES=true

#-----------------------#
#- Path and Env Config -#
#-----------------------#
PATH="$HOME/.local/bin:$HOME/bin:$PATH"
export PATH
PATH="$HOME/.cabal/bin:$PATH"
export PATH

# set environment variables for go
GOBIN="$HOME/code/go_src/bin"
export GOBIN
GOPATH="$HOME/code/go_src"
export GOPATH
GOROOT="/usr/local/go" # needs to be set if go is in custom location
export GOROOT
PATH="$GOROOT/bin:$PATH"
export PATH

# prevent ranger from loading rc.conf from
# /usr/share/doc/config/ and ~/.config/ranger
export RANGER_LOAD_DEFAULT_RC=FALSE

# set environment variables for rust
# RUST_SRC_PATH="$(rustc --print sysroot)/lib/rustlib/src/rust/src"
# export RUST_SRC_PATH

# configure fzf layout
export FZF_DEFAULT_OPTS='--layout=reverse --height 80%'

# 256-color terminal is needed for vim not to break!
export TERM="tmux-256color"

#-----------#
#- Aliases -#
#-----------#
# source ~/.bashrc more easily when changing this file
alias src="source ~/.bashrc && echo 'sourced .bashrc'"

# useful when configuring .Xresources
alias xup="xrdb ~/dotfiles/.Xresources"

# always use vim-x11 for system clipboard access
alias nv="nvim -p"
alias v="nvim -p"
alias vi="nvim -p"
alias vim="nvim -p"

# create for file browsing and viewing
alias c="clear"
alias ex="exit" # shadows vim's `ex'
alias f="ranger"
alias m="mupdf"
alias bird="thunderbird &"

# useful for faster navigation and file manipulation
alias p="pwd"

alias h="cd ~"
alias co="cd ~/code"
alias dc="cd ~/Documents" # can't use keyword `do' here!
alias dw="cd ~/Downloads"
alias dotfiles="cd ~/dotfiles" # `dot' shadows graphviz

alias bashrc="v ~/dotfiles/.bashrc"
alias vimrc="v ~/dotfiles/vim-config/configs.vim"
alias tmux_conf="v ~/dotfiles/.tmux.conf"

# remap some GNU utils to rust utilities
alias ls="exa --git"
alias l="exa -lahF --git"
alias ll="exa -lahF --git"
alias t="tokei"
alias b="bat"

# easy access to ipython
alias py="ipython"

# copy to system clipboard by default
alias xclip="xclip -selection clipboard"

# access music player more easily
alias n="sudo ncmpcpp --screen=media_library --bindings=\$HOME/.ncmpcpp/bindings --config=\$HOME/.ncmpcpp/config"

# open ipython in vim mode automatically
alias ipython="ipython --TerminalInteractiveShell.editing_mode=vi"

# Suppress annoying GTK warnings that mess up gnome-term.
# Solution adapted from: http://askubuntu.com/questions/505594.
# The following generates a function named $1 which:
# - executes $(which $1) [with args]
# - suppresses output lines which match $2
# e.g. adding: _suppress echo "hello\|world"
# will generate this function:
# echo() { $(which echo) "$@" 2>&1 | tr -d '\r' | grep -v "hello\|world"; }
# and from now on, using echo will work normally except that lines with
# hello or world will not show at the output
# to see the generated functions, replace eval with echo below
# the 'tr' filter makes sure no spurious empty lines pass from some commands
_suppress() {
  eval "$1() { \$(which $1) \"\$@\" 2>&1 | tr -d '\r' | grep -v \"$2\"; }"
}

_suppress gedit          "Gtk-WARNING\|connect to accessibility bus"
_suppress firefox        "Gtk-WARNING\|g_slice_set_config\|Gtk\|WARNING\|Warning"
