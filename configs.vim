"*********************"
"** General Configs **"
"*********************"
" set line numbers, line wrapping, etc.
set number
set relativenumber
set nocompatible
filetype plugin on
syntax on
set encoding=utf-8
set textwidth=0 wrapmargin=0 " disable physical line wrapping
set autoread " check if file was changed outside of vim before saving

"*********************"
"** Custom Mappings **"
"*********************"
" leader is set in another config file!
" remap <ESC> to <leader>n for fast return to normal mode
inoremap <leader>n <ESC>

" fast quitting with <leader>q
nmap <leader>q :q<cr>

" move more intuitively between wrapped lines with j/k
" instead of gj/gk
nnoremap j gj
nnoremap k gk

" display buffer using <leader>b
nnoremap <leader>b :ls<CR>:buffer<Space>

" update the current buffer with <leader>u
" this is useful if the current file was changed somewhere else
nnoremap <leader>u :edit<CR>

" toggle indentation guides
nnoremap <leader>t :set list listchars=tab:❘-,trail:·,extends:»,precedes:«,nbsp:×<CR>

" remap space and return to do what one expects
nnoremap <Space> i<Space><Right><ESC>
nmap <S-Enter> O<ESC>
nmap <CR> o<ESC>k

" re-map system clipboard copying commands
noremap <leader>y "+y
noremap <leader>Y "+Y
noremap <leader>p "+p
noremap <leader>P "+P

"******************"
"** Autocommands **"
"******************"
" fast compilation of rust, js and c src files
" could be expanded to quickly compile other languages, too
autocmd FileType rust nnoremap <leader>c :!cargo run<CR>
autocmd FileType c nnoremap <leader>c :!gcc % -o prog && ./prog<CR>
autocmd FileType js nnoremap <leader>c :!node %<CR>

" On save:
" run rustfmt on all rust files in current dir
" if file extension of current buffer == '.rs'
autocmd BufNewFile,BufWritePost *.rs silent execute '!rustfmt *.rs'

" delete all trailing whitespace
autocmd BufWritePre * %s/\s\+$//e

"********************"
"** Plugin Configs **"
"********************"
" Emmet Configs
" -------------
" remap emmet leader (the actual leader (trailing ',')
" still needs to be added)
let g:user_emmet_leader_key='<C-D>'

" YCM Configs
" -----------
" set path to extra configs (including compiler flags)
"let g:ycm_filetype_specific_completion_to_disable = { 'html': 1 }
let g:ycm_global_ycm_extra_conf = '~/dotfiles/.ycm_extra_conf.py'

" Go-Vim Configs
" --------------
" add golang linter path to runtime path
set rtp+=$GOPATH/src/github.com/golang/lint/misc/vim

" disable location lists for go-vim
"let g:go_list_type = "quickfix"

" run :GoBuild or :GoTestCompile based on the go file
function! s:build_go_files()
  let l:file = expand('%')
  if l:file =~# '^\f\+_test\.go$'
    call go#test#Test(0, 1)
  elseif l:file =~# '^\f\+\.go$'
    call go#cmd#Build(0)
  endif
endfunction

" build go files automatically
autocmd FileType go nmap <leader>b :<C-u>call <SID>build_go_files()<CR>

" toggle test coverage profile with <leader>c
autocmd FileType go nmap <Leader>c <Plug>(go-coverage-toggle)

" some optional go syntax highlighting
"let g:go_highlight_function_calls = 1
"let g:go_highlight_operators = 1
let g:go_highlight_types = 1
let g:go_highlight_fields = 1
let g:go_highlight_functions = 1
let g:go_highlight_extra_types = 1
let g:go_highlight_build_constraints = 1
let g:go_highlight_generate_tags = 1

" call go info with <leader>i
autocmd FileType go nmap <Leader>i <Plug>(go-info)

" automatically display go info with an update time of 100ms
let g:go_auto_type_info = 1
set updatetime=100

" automatically highlight matching identifiers
let g:go_auto_sameids = 1

" Ale Configs
" -----------
" Set `ale_fix_on_save' to 1 to fix files when you save them.
let g:ale_fix_on_save = 1

" Enable completion where available.
let g:ale_completion_enabled = 1

" Enable auto-completion using github.com/maralla/completor.vim
let g:completor_gocode_binary = '/Users/daniel/Documents/GitHub/go/src/github.com/nsf/gocode/'
let g:completor_python_binary = '/Library/Frameworks/Python.framework/Versions/3.7/bin/python3'

"*****************"
"** Colorscheme **"
"*****************"
" Default color scheme is `peaksea' to get the default appearance,
" comment all 'highlight' commands.
" Other colorschemes are ir_black, solarized, mayansmoke, pyte and
" many more (check with :colorscheme <tab>).
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
