" load plugin paths with pathogen
let s:vim_runtime = '~/dotfiles/vim-config'
call pathogen#infect(s:vim_runtime.'/plugins/{}')
call pathogen#helptags()
