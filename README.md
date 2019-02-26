# Dotfiles

## Vim Configuration

### Installation

Just clone this repository into `/home/user/dotfiles`. Then create the following `.vimrc`:

```vim
" `~/.vimrc' that source all dependencies in
" `~/dotfiles/vim-config'.
" set runtime path
set runtimepath+=~/dotfiles/vim-config

" load pathogen first to enable plugins
try
    source ~/dotfiles/vim-config/infect.vim
catch
endtry

" load vim configs (main config file)
try
    source ~/dotfiles/vim-config/configs.vim
catch
endtry
```

### Deprecated way to install this vim config

**Warning**: The `vim-config` can now be cloned and should work out of the box.

You must have `https://github.com/amix/vimrc` installed! Then, put `configs.vim` in `$HOME/dotfiles/` and modify `$HOME/.vimrc` as follows:

```vim
" source configs.vim from $HOME/dotfiles
try
source $HOME/dotfiles/configs.vim
catch
endtry
```

To install additional plugins, use [Pathogen](https://github.com/tpope/vim-pathogen):

```bash
# a nice, improved syntax highlighter for js
git clone https://github.com/pangloss/vim-javascript.git ~/.vim_runtime/my_plugins/vim-javascript

# emmet plugin for advanced html autocompletion (remapped to <C-D>,)
git clone https://github.com/mattn/emmet-vim.git ~/.vim_runtime/my_plugins/emmet-vim

# plugin for using ranger from within vim (<leader>f)
git clone https://github.com/francoiscabrol/ranger.vim ~/.vim_runtime/my_plugins/vim-ranger

# rust plugin
git clone --depth=1 https://github.com/rust-lang/rust.vim.git ~/.vim_runtime/my_plugins/rust.vim

# racer rust (for completions)
git clone --depth=1 https://github.com/racer-rust/vim-racer.git ~/.vim_runtime/my_plugins/vim-racer

# vim autocompletion!
# has some dependencies, e.g. Mono for C# and python3-devel (check their documentation)
git clone https://github.com/Valloric/YouCompleteMe.git ./YouCompleteMe
cd YouCompleteMe
git submodule update --init --recursive
python3 install.py --clang-completer --go-completer --cs-completer --ts-completer --rust-completer
```

## .bashrc
Works on Fedora. Install in `$HOME/dotfiles/` and modify `$HOME/.bashrc` as follows:

```bash
# source .bashrc from $HOME/dotfiles
source $HOME/dotfiles/.bashrc
```

## .tmux.conf
Make sure you have tmux version >=2.1 installed. Then, put the config file in `$HOME/dotfiles/` and modify `$HOME/.tmux.conf` as follows:

```tmux
# source config file
source-file ~/dotfiles/.tmux.conf
```

## .Xresources
Put the following line in your `.xinitrc`:
```bash
xrdb ~/dotfiles/.Xresources
```
A bash alias exists, too. `$xup` will load changes in `.Xresources` without restarting the xserver.

## install.sh/update.sh
Files like `i3.config` and `.xinitrc` are usually installed into a default location like `~` or `~/.config/`. To achieve that, the respective version from this repository can automatically be installed with:

```bash
$./install.sh
```

After changing the file in those locations, this repository can easily be updated as follows:

```bash
$./update.sh
```

Lastly, all configs can be removed, too:

```bash
$./remove.sh
```
