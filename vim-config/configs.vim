"*********************"
"** General Configs **"
"*********************"
" set line numbers, line wrapping, etc.
filetype plugin on
filetype indent on
syntax on
syntax enable
set number
set relativenumber
set nocompatible
set encoding=utf-8
set ffs=unix,dos,mac " make unix the standard file system
set textwidth=0 wrapmargin=0 " disable physical line wrapping
set autoread " check if file was changed outside of vim before saving
set so=5 " screen scrolls 5 lines before top/bottom
set history=500
set wildmenu " enable command line completions
set ruler " show current position
set cmdheight=2 " command bar height
set hid " hide buffers once abandoned
set backspace=eol,start,indent " configure backspace, p1
set whichwrap+=<,>,h,l " configure backspace, p2
set ignorecase " generally ignore cases in search
set smartcase " try to be smart about cases in search
set hlsearch " highlight search results
set incsearch " modern browser-like search
set lazyredraw " don't redraw buffer when executing macros
set magic " for regular expressions
set showmatch " show matching brackets when cursor is over them
set mat=2 " tenth of a second to blink matching brackets
set noerrorbells " turn error sound off, p1
set novisualbell " turn error sound off, p2
set t_vb= " turn error sound off, p3
set tm=500 " turn error sound off, p4
set foldcolumn=0 " extra margin to the left if >0
set nobackup " turn backups off, p1
set nowb " turn backups off, p2
set noswapfile " turn backups off, p3
set expandtab " spaces instead of tabs
set smarttab " smart tabs
set shiftwidth=4 " one tab is 4 spaces
set tabstop=4
set lbr " set line break
set tw=500 " line break on 500 chars
set ai " set auto indent
set si " set smart indent
set wrap "set wrap lines

" always should status line and edit the status line format
set laststatus=2
set statusline=\ %{HasPaste()}%F%m%r%h\ %w\ \ CWD:\ %r%{getcwd()}%h\ \ \ Line:\ %l\ \ Column:\ %c

" avoid garbled characters in Chinese language
let $LANG='en'
set langmenu=en
source $VIMRUNTIME/delmenu.vim
source $VIMRUNTIME/menu.vim

" Lightline Config
" ----------------
" The only plugin configuration that is not in the 'correct' section.
" Lightline is responsible for the status bar, that's why it is up here.
" This config also uses lightline ale.
" The previous branch symbol was , but it is sticking out.
" On the right site,  can be used as the major delimiter.
let g:lightline = {
      \ 'colorscheme': 'solarized',
      \ 'active': {
      \   'left': [ ['mode', 'paste'],
      \             ['fugitive', 'readonly', 'filename', 'modified'] ],
      \   'right': [ ['lineinfo'],
      \              ['percent'],
      \              ['fileformat', 'filetype'],
      \              ['linter_checking', 'linter_errors', 'linter_warnings', 'linter_ok'] ]
      \ },
      \ 'component_expand': {
      \   'linter_checking': 'lightline#ale#checking',
      \   'linter_warnings': 'lightline#ale#warnings',
      \   'linter_errors':   'lightline#ale#errors',
      \   'linter_ok':       'lightline#ale#ok'
      \ },
      \ 'component_type': {
      \   'linter_checking': 'left',
      \   'linter_warnings': 'warning',
      \   'linter_errors':   'error',
      \   'linter_ok':       'left'
      \ },
      \ 'component': {
      \   'readonly': '%{&filetype=="help"?"":&readonly?"🔒":""}',
      \   'modified': '%{&filetype=="help"?"":&modified?"+":&modifiable?"":"-"}',
      \   'fugitive': "%{fugitive#head()!=''?'\ ⎇ \ '.fugitive#head().'\ ':''}",
      \ },
      \ 'component_visible_condition': {
      \   'readonly': '(&filetype!="help"&& &readonly)',
      \   'modified': '(&filetype!="help"&&(&modified||!&modifiable))',
      \   'fugitive': '(exists("*fugitive#head") && ""!=fugitive#head())'
      \ },
      \ 'separator': { 'left': '', 'right': ' ' },
      \ 'subseparator': { 'left': '\u25B6', 'right': '|' }
      \ }

" If Fontawesome or another iconic font is installed, the following
" icons can be used as linter warning and error indicators:
let g:lightline#ale#indicator_checking = "\uf110  "
let g:lightline#ale#indicator_warnings = "\uf071  "
let g:lightline#ale#indicator_errors = "\uf05e  "
let g:lightline#ale#indicator_ok = "\uf00c  "

"*********************"
"** Custom Mappings **"
"*********************"
" remap 0 to go to first non-blank character
map 0 ^

" leader is set to ,
let mapleader = ","

" remap <ESC> to <leader>n for fast return to normal mode
inoremap <leader>n <ESC>

" fast quitting with <leader>q
nmap <leader>q :q<cr>

" Fast saving with <leader>w
nmap <leader>w :w!<cr>

" :W sudo saves the file
" (useful for handling the permission-denied error)
command W w !sudo tee % > /dev/null

" move more intuitively between wrapped lines with j/k
" instead of gj/gk
nnoremap j gj
nnoremap k gk

" display buffer using <leader>b
nnoremap <leader>b :ls<CR>:buffer<Space>

" update the current buffer with <leader>u
" this is useful if the current file was changed somewhere else
nnoremap <leader>u :edit<CR>

" toggle indentation guides (set by default)
set list listchars=tab:❘-,trail:·,extends:»,precedes:«,nbsp:×
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

" Pressing ,ss will toggle and untoggle spell checking
map <leader>ss :setlocal spell!<cr>

" pressing * or # in visual mode searches for the current selection
vnoremap <silent> * :<C-u>call VisualSelection('', '')<CR>/<C-R>=@/<CR><CR>
vnoremap <silent> # :<C-u>call VisualSelection('', '')<CR>?<C-R>=@/<CR><CR>

" disable highlight when <leader># is pressed
map <leader># :noh<cr>

"**********************"
"** Buffers and Tabs **"
"**********************"
" search forwards and backwards with <space> and <ctrl><space>
map <space> /
map <c-space> ?

" smart way to move between windows
map <C-j> <C-W>j
map <C-k> <C-W>k
map <C-h> <C-W>h
map <C-l> <C-W>l

" close the current buffer
map <leader>bd :Bclose<cr>:tabclose<cr>gT

" close all buffers
map <leader>ba :bufdo bd<cr>

" move inbetween buffers
map <leader>l :bnext<cr>
map <leader>h :bprevious<cr>

" useful mappings for managing tabs
map <leader>tn :tabnew<cr>
map <leader>to :tabonly<cr>
map <leader>tc :tabclose<cr>
map <leader>tm :tabmove
map <leader>t<leader> :tabnext

" let 'tl' toggle between this and the last accessed tab
let g:lasttab = 1
nmap <Leader>tl :exe "tabn ".g:lasttab<CR>
au TabLeave * let g:lasttab = tabpagenr()

" opens a new tab with the current buffer's path
" useful when editing files in the same directory
map <leader>te :tabedit <c-r>=expand("%:p:h")<cr>/

" switch CWD to the directory of the open buffer
map <leader>cd :cd %:p:h<cr>:pwd<cr>

" ppecify the behavior when switching between buffers
try
  set switchbuf=useopen,usetab,newtab
  set stal=2
catch
endtry

" return to last edit position when opening files
au BufReadPost * if line("'\"") > 1 && line("'\"") <= line("$") | exe "normal! g'\"" | endif

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

" delete all trailing whitespace on save
autocmd BufWritePre * %s/\s\+$//e

" delete trailing white space on save, another way to do it
fun! CleanExtraSpaces()
    let save_cursor = getpos(".")
    let old_query = getreg('/')
    silent! %s/\s\+$//e
    call setpos('.', save_cursor)
    call setreg('/', old_query)
endfun

if has("autocmd")
    autocmd BufWritePre *.txt,*.js,*.py,*.wiki,*.sh,*.coffee :call CleanExtraSpaces()
endif

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

" MRU Configs
" -----------
" limit history to 100 files and open most recently used with <leader>m
let MRU_Max_Entries = 100
map <leader>m :MRU<CR>

" Vim Racer Configs
" -----------------
" `hidden' mode for buffers helps with goto definitions
set hidden

" only require if not in path (only as a fallback)
let g:racer_cmd = "/home/daniel/.cargo/bin/racer"

" experimental completer for full function definitions
let g:racer_experimental_completer = 1

" plugin mappings for seeing definitions and docs
" ALWAYS use <leader> with `r' mappings to be able
" to use regular replace with `r' i normal mode
au FileType rust nmap gd <Plug>(rust-def)
au FileType rust nmap gs <Plug>(rust-def-split)
au FileType rust nmap gx <Plug>(rust-def-vertical)
au FileType rust nmap <leader>rd <Plug>(rust-doc)

" Git Gutter Configs
" ------------------
" enable by default, toggle with <leader>d
let g:gitgutter_enabled = 1
nnoremap <silent> <leader>d :GitGutterToggle<cr>

" Vim Go Configs
" --------------
" set `goimports' to be used to format src files
let g:go_fmt_command = "goimports"

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
" enable highlighting of linter findings
let g:ale_set_highlights = 1

" only run linting and fix files when saving them, not
" when text changes or a new buffer is opened
let g:ale_lint_on_text_changed = 'never'
let g:ale_lint_on_enter = 0
let g:ale_fix_on_save = 1

" enable completion where available.
let g:ale_completion_enabled = 1

" enable auto-completion using github.com/maralla/completor.vim
let g:completor_gocode_binary = '/Users/daniel/Documents/GitHub/go/src/github.com/nsf/gocode/'
let g:completor_python_binary = '/Library/Frameworks/Python.framework/Versions/3.7/bin/python3'

" set linters and fixers
" This requires the respective linters to be installed,
" most of them have pretty good instructions on GitHub, though.
" Start here: https://github.com/w0rp/ale or
" here: https://github.com/w0rp/ale/blob/master/supported-tools.md.
" Usually, tools only need to be installed to work without
" additional settings in this file. Some language configs are set
" manually, anyways.
let g:ale_linters = {
\   'javascript': ['prettier', 'jshint'],
\   'python': ['flake8'],
\   'go': ['go', 'golint', 'errcheck'],
\   'vim': ['vint']
\}

let g:ale_fixers = {
\   'javascript': ['prettier'],
\   'python': ['flake8']
\}

nmap <silent> <leader>a <Plug>(ale_next_wrap)

" Omni Complete Config
" --------------------
autocmd FileType css set omnifunc=csscomplete#CompleteCSS

" BufExplorer Config
" ------------------
let g:bufExplorerDefaultHelp=0
let g:bufExplorerShowRelativePath=1
let g:bufExplorerFindActive=1
let g:bufExplorerSortBy='name'
map <leader>o :BufExplorer<cr>

"*****************"
"** Parentheses **"
"*****************"
" Auto-enclose text with parens in visual mode.
" Vim-surround actually uses the same keys for
" surrounding a visual mode selection with parens
" and quotes.
vnoremap $1 <esc>`>a)<esc>`<i(<esc>
vnoremap $2 <esc>`>a]<esc>`<i[<esc>
vnoremap $3 <esc>`>a}<esc>`<i{<esc>
vnoremap $$ <esc>`>a"<esc>`<i"<esc>
vnoremap $q <esc>`>a'<esc>`<i'<esc>
vnoremap $e <esc>`>a"<esc>`<i"<esc>

" auto-complete parens in insert mode
inoremap $1 ()<esc>i
inoremap $2 []<esc>i
inoremap $3 {}<esc>i
inoremap $4 {<esc>o}<esc>O
inoremap $q ''<esc>i
inoremap $e ""<esc>i

"*****************"
"** Colorscheme **"
"*****************"
" Disable Background Color Erase (BCE) so that color schemes
" render properly when inside 256-color tmux and GNU screen.
" See also http://sunaku.github.io/vim-256color-bce.html.
if &term =~ '256color'
    set t_ut=
endif

" fix tmux color bug by setting `term'
if exists('$TMUX')
    if has('nvim')
        set termguicolors
    else
        set term=screen-256color
    endif
endif

" enable 256 colors palette in Gnome Terminal
let g:solarized_termcolors=256
if $COLORTERM == 'gnome-terminal'
    set t_Co=256
endif

" Set a non-default color scheme. To get the dark solarized
" color scheme, the block below (resetting background,
" hightlights, etc.) is required, too!
colorscheme solarized
set background=dark
highlight Normal ctermbg=None
highlight nonText ctermbg=None
highlight clear LineNr
highlight clear SignColumn
hi Visual guibg=white guifg=black gui=NONE ctermfg=black ctermbg=white cterm=reverse

"********************************"
"** File Type Specific Configs **"
"********************************"
" Python
let python_highlight_all = 1
au FileType python syn keyword pythonDecorator True None False self
au BufNewFile,BufRead *.jinja set syntax=htmljinja
au FileType python map <buffer> F :set foldmethod=indent<cr>
au FileType python inoremap <buffer> $r return
au FileType python inoremap <buffer> $i import
au FileType python inoremap <buffer> $p print
au FileType python inoremap <buffer> $f # --- <esc>a
au FileType python map <buffer> <leader>1 /class
au FileType python map <buffer> <leader>2 /def
au FileType python map <buffer> <leader>C ?class
au FileType python map <buffer> <leader>D ?def
au FileType python set cindent
au FileType python set cinkeys-=0#
au FileType python set indentkeys-=0#

" JavaScript
au FileType javascript call JavaScriptFold()
au FileType javascript setl fen
au FileType javascript setl nocindent
au FileType javascript imap <c-t> $log();<esc>hi
au FileType javascript imap <c-a> alert();<esc>hi
au FileType javascript inoremap <buffer> $r return
au FileType javascript inoremap <buffer> $f // --- PH<esc>FP2xi

function! JavaScriptFold()
    setl foldmethod=syntax
    setl foldlevelstart=1
    syn region foldBraces start=/{/ end=/}/ transparent fold keepend extend

    function! FoldText()
        return substitute(getline(v:foldstart), '{.*', '{...}', '')
    endfunction
    setl foldtext=FoldText()
endfunction

"**********************"
"** Helper Functions **"
"**********************"
" Returns true if paste mode is enabled
function! HasPaste()
    if &paste
        return 'PASTE MODE  '
    endif
    return ''
endfunction

" Don't close window, when deleting a buffer
command! Bclose call <SID>BufcloseCloseIt()
function! <SID>BufcloseCloseIt()
    let l:currentBufNum = bufnr("%")
    let l:alternateBufNum = bufnr("#")

    if buflisted(l:alternateBufNum)
        buffer #
    else
        bnext
    endif

    if bufnr("%") == l:currentBufNum
        new
    endif

    if buflisted(l:currentBufNum)
        execute("bdelete! ".l:currentBufNum)
    endif
endfunction

function! CmdLine(str)
    call feedkeys(":" . a:str)
endfunction

function! VisualSelection(direction, extra_filter) range
    let l:saved_reg = @"
    execute "normal! vgvy"

    let l:pattern = escape(@", "\\/.*'$^~[]")
    let l:pattern = substitute(l:pattern, "\n$", "", "")

    if a:direction == 'gv'
        call CmdLine("Ack '" . l:pattern . "' " )
    elseif a:direction == 'replace'
        call CmdLine("%s" . '/'. l:pattern . '/')
    endif

    let @/ = l:pattern
    let @" = l:saved_reg
endfunction

func! CurrentFileDir(cmd)
    return a:cmd . " " . expand("%:p:h") . "/"
endfunc
