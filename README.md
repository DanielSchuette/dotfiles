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
