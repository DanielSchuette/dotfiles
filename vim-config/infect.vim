" load plugin paths with pathogen
let s:vim_runtime = "/home/daniel/dotfiles/vim-config"
call pathogen#infect(s:vim_runtime.'/plugins/{}')
call pathogen#helptags()
