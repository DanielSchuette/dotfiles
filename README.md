# Dotfiles

## .bashrc
Works on Fedora. Install in `$HOME/dotfiles/` and modify `$HOME/.bashrc` as follows:

```bash
# source .bashrc from $HOME/dotfiles
source $HOME/dotfiles/.bashrc
```

## configs.vim
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
# example of a nice improved syntax highlighter for js
git clone https://github.com/pangloss/vim-javascript.git ~/.vim_runtime/my_plugins/vim-javascript
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
