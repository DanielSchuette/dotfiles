" some general configs
" some additional modifications are made to the basic.vim file as well (e.g. color scheme)
set number
set relativenumber
set nocompatible
filetype plugin on
syntax on
set encoding=utf-8

"Automatically deletes all trailing whitespace on save.
autocmd BufWritePre * %s/\s\+$//e

" disable physical line wrapping
set textwidth=0 wrapmargin=0

" check if file was changed outside of vim before saving ...
set autoread
" ... then, update the current buffer with <leader>u
nmap <leader>u :edit<cr>

" display indentation guides
"set list listchars=tab:❘-,trail:·,extends:»,precedes:«,nbsp:×

nnoremap <Space> i<Space><Right><ESC>
nmap <S-Enter> O<ESC>
nmap <CR> o<ESC>k

set rtp+=$GOPATH/src/github.com/golang/lint/misc/vim

" remap <ESC> to <leader>nn
inoremap <leader>nn <ESC>

" Fast quitting
nmap <leader>qq :q<cr>

" Go-Vim remaps and settings
" disable location lists for go-vim
" let g:go_list_type = "quickfix"

" run :GoBuild or :GoTestCompile based on the go file
function! s:build_go_files()
  let l:file = expand('%')
  if l:file =~# '^\f\+_test\.go$'
    call go#test#Test(0, 1)
  elseif l:file =~# '^\f\+\.go$'
    call go#cmd#Build(0)
  endif
endfunction

autocmd FileType go nmap <leader>b :<C-u>call <SID>build_go_files()<CR>

" toggle test coverage profile with <leader>c
autocmd FileType go nmap <Leader>c <Plug>(go-coverage-toggle)

" some optional go syntax highlighting
let g:go_highlight_types = 1
let g:go_highlight_fields = 1
let g:go_highlight_functions = 1
" let g:go_highlight_function_calls = 1
" let g:go_highlight_operators = 1
let g:go_highlight_extra_types = 1
let g:go_highlight_build_constraints = 1
let g:go_highlight_generate_tags = 1

" call go info with <leader>i
autocmd FileType go nmap <Leader>i <Plug>(go-info)

" automatically display go info with an update time of 200ms
let g:go_auto_type_info = 1
set updatetime=100

" automatically highlight matching identifiers
let g:go_auto_sameids = 1

" Ale linter configs
" Set `ale_fix_on_save' to 1 to fix files when you save them.
let g:ale_fix_on_save = 1

" Enable completion where available.
let g:ale_completion_enabled = 1

" Enable auto-completion using github.com/maralla/completor.vim
let g:completor_gocode_binary = '/Users/daniel/Documents/GitHub/go/src/github.com/nsf/gocode/'
let g:completor_python_binary = '/Library/Frameworks/Python.framework/Versions/3.7/bin/python3'

" Colorscheme
" default color scheme: peaksea
" to get the default appearance, comment all 'highlight' commands
" other schemes: ir_black, solarized, mayansmoke, pyte and many
" more (check with :colorscheme <tab>)
let g:solarized_termcolors=256
" required for the non-default color scheme
colorscheme solarized

" clear the gray background
set background=dark
set t_Co=256
highlight Normal ctermbg=None
highlight nonText ctermbg=None
highlight clear LineNr
highlight clear SignColumn

" another custom script to set visual mode highlighting colors:
hi Visual guibg=white guifg=black gui=NONE ctermfg=black ctermbg=white cterm=reverse

" disable Background Color Erase (BCE) so that color schemes
" render properly when inside 256-color tmux and GNU screen.
" see also http://sunaku.github.io/vim-256color-bce.html
if &term =~ '256color'
    set t_ut=
endif

" re-map system clipboard copying commands
noremap <Leader>y "+y
noremap <Leader>Y "+Y
noremap <Leader>p "+p
noremap <Leader>P "+P

" let g:ycm_filetype_specific_completion_to_disable = { 'html': 1 }
