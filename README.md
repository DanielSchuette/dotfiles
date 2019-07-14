# Dotfiles

## Vim Configuration

### Installation

Just clone this repository into `$HOME/dotfiles`. Then create the following `.vimrc` in `$HOME`:

```vim
" `~/.vimrc' that source all dependencies in `~/dotfiles/vim-config'.

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

### Plugins
**There are three to things to consider:**
1. There might be absolute file paths in `vim-config/configs.vim` that I have overlooked and that need to be fixed. A pull request would be awesome because then I could fix the issue permanently in this repository.

2. Some plugins need to be compiled from source and/or have dependencies that need to be installed for the plugin to function properly (especially `YouCompleteMe` and `racer`, everything else should work without any problems). See the respective documentation of any plugin that does not work for installation instructions. It is likely that you have to delete the respective plugin in `vim-config/plugins/` and re-install it from scratch.

3. Linting with `ale` requires the respective linters to be installed. Some documentation is provided in the `ale` section in `configs.vim`.

### Additional syntax files
To add additional syntax files, create `~/.vim/syntax/` and `~/.vim/ftdetect/` if these directories don't exist. Syntax files go into the first directory, a one-line file in the second directory ensures that the filetype is detected correctly. An `Oberon` example:

```bash
cp ~/dotfiles/vim_config/syntax/oberon.vim ~/.vim/syntax/oberon.vim
cp ~/dotfiles/vim_config/syntax/ft.vim ~/.vim/ftdetect/oberon.vim
```

## .bashrc
Install in `$HOME/dotfiles/` and modify `$HOME/.bashrc` as follows:

```bash
# source .bashrc from $HOME/dotfiles
source $HOME/dotfiles/.bashrc
```

## .tmux.conf
Make sure you have tmux version >=2.9 installed (i.e. the first version that uses the new configuration file syntax). Then, put the config file in `$HOME/dotfiles/` and modify `$HOME/.tmux.conf` as follows:

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
