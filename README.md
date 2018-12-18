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
