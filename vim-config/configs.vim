"*********************"
"** General Configs **"
"*********************"
set encoding=utf-8
scriptencoding " isn't usually required with utf-8
filetype plugin on
filetype indent on
syntax on
syntax enable
set number
set relativenumber
set fileformats=unix,dos,mac " make unix the standard file system
set textwidth=0 wrapmargin=0 " disable physical line wrapping
set autoread " check if file was changed outside of vim before saving
set scrolloff=2 " screen scrolls 2 lines before top/bottom
set history=500
set wildmenu " enable command line completions
set wildmode=full
set ruler " show current position
set cmdheight=2 " command bar height
set hidden " hide buffers once abandoned
set backspace=eol,start,indent " configure backspace, p1
set whichwrap+=<,>,h,l " configure backspace, p2
set ignorecase " generally ignore cases in search
set smartcase " try to be smart about cases in search
set hlsearch " highlight search results
set incsearch " modern browser-like search
set lazyredraw " don't redraw buffer when executing macros
set magic " for regular expressions
set showmatch " show matching brackets when cursor is over them
set matchtime=2 " tenth of a second to blink matching brackets
set noerrorbells " turn error sound off, p1
set novisualbell " turn error sound off, p2
set t_vb= " turn error sound off, p3
set timeoutlen=500 " turn error sound off, p4
set foldcolumn=0 " extra margin to the left if >0
set nobackup " turn backups off, p1
set nowritebackup " turn backups off, p2
set noswapfile " turn backups off, p3
set expandtab " spaces instead of tabs
set smarttab
set shiftwidth=4 " one tab is 4 spaces
set tabstop=4
set wrap        " soft wrap 1
set linebreak   " soft wrap 2
set autoindent
set smartindent
set laststatus=2 " always show status line
set statusline=\ %{HasPaste()}%F%m%r%h\ %w\ \ CWD:\ %r%{getcwd()}%h\ \ \ Line:\ %l\ \ Column:\ %c
set noshowmode " because lightline shows the mode

" neovim-specific configuration
set guicursor=

" Lightline Config
" ----------------
" The only plugin configuration that is not in the 'correct' section.
" Lightline is responsible for the status bar, that's why it is up here.
" This config also uses lightline ale.
" With some fonts, it looks better to use ⎇ as a branch symbol..
" On the right site,  can be used as the major delimiter.
" Also, instead of showing the absolute file path, 'filename' can be used.
" NOTE(daniel): change colorscheme back to solarized if wanted!
let g:lightline = {
      \ 'colorscheme': 'gruvbox',
      \ 'active': {
      \   'left': [ ['mode', 'paste'],
      \             ['fugitive', 'readonly', 'absolutepath', 'modified'] ],
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
      \   'fugitive': "%{fugitive#head()!=''?'\\ '.fugitive#head().'\ ':''}",
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
let g:lightline#ale#indicator_warnings = "\uf071 "
let g:lightline#ale#indicator_errors = "\uf05e "
let g:lightline#ale#indicator_checking = "\uf110"
let g:lightline#ale#indicator_ok = "\uf00c"

"*********************"
"** Custom Mappings **"
"*********************"
" it is more convenient if 0 jumps to the first non-blank character
map 0 ^
let mapleader = ','

" remap <ESC> to <leader>n for fast return to normal mode
inoremap <leader>n <ESC>

" fast quitting and saving with <leader>q and <leader>w
nmap <leader>q :q<cr>
nmap <leader>w :w!<cr>

" move more intuitively between wrapped lines with j/k
" instead of gj/gk
nnoremap j gj
nnoremap k gk

" display buffers using <leader>b
nnoremap <leader>b :ls<CR>:buffer<Space>

" toggle indentation guides (set by default) with <leader>t
set list
set listchars=tab:❘-,trail:·,extends:»,precedes:«,nbsp:×

function! ToggleListchars()
    if &listchars ==# ''
        echo 'toggle listchars to set'
        set list
        set listchars=tab:❘-,trail:·,extends:»,precedes:«,nbsp:×
    else
        echo 'toggle listchars to not set'
        set nolist

        set listchars=
    endif
endfunction

nnoremap <leader>t :<C-U>call ToggleListchars()<CR>

" remap return to insert a blank line after the cursor's line
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

" <leader>r executes a `run.sh' script (useful for complex builds)
nnoremap <leader>r :!chmod +x run.sh && ./run.sh<CR>

"**********************"
"** Buffers and Tabs **"
"**********************"
" search forwards and backwards with <space> and <ctrl><space>
map <space> /
map <c-space> ?

" easier way to move between windows
map <C-j> <C-W>j
map <C-k> <C-W>k
map <C-h> <C-W>h
map <C-l> <C-W>l
nnoremap <TAB> <C-W>w

" move inbetween buffers
map <leader>l :bnext<cr>
map <leader>h :bprevious<cr>

" specify the behavior when switching between buffers
try
  set switchbuf=useopen,usetab,newtab
  set showtabline=2
catch
endtry

"******************"
"** Autocommands **"
"******************"
augroup on_open
    " clear out previous autocmds in this group (should always be done)
    autocmd!

    " return to last edit position when opening files
    autocmd BufReadPost * if line("'\"") > 1 && line("'\"") <= line("$") | exe "normal! g'\"" | endif
augroup END

augroup fast_compilation
    autocmd!

    " fast compilation of rust, js and c src files
    " could be expanded to quickly compile other languages, too
    autocmd FileType rust nnoremap <leader>c :!cargo run<CR>
    autocmd FileType c nnoremap <leader>c :!gcc % -o prog && ./prog<CR>
    autocmd FileType js nnoremap <leader>c :!node %<CR>
augroup END

" On save:
" Run rustfmt on all rust files in current dir if file
" extension of current buffer == '.rs'. Run rustfmt with
" <leader>rf instead if error messages are wanted.
" Also, delete all trailing whitespace on save.
nnoremap <leader>rf :!rustfmt % *.rs<CR>

augroup on_save
    autocmd!

    autocmd BufNewFile,BufWritePost *.rs silent execute '!rustfmt % *.rs &> /dev/null'
    autocmd BufWritePre * %s/\s\+$//e
augroup END

"********************"
"** Plugin Configs **"
"********************"
" Ctags
" Vim supports ctags natively, but some of the keybindings are awkward by
" default. They are redefined here. Tagbar must be installed separately.
set tags=./tags,tags; " where to look for tags file
nnoremap <leader>ct <C-]>
nnoremap <leader>cT <C-t>
nnoremap <leader>tb :TagbarToggle<CR>

" Vim-Markdown Configs
" --------------------
" disable automatic folding
let g:vim_markdown_folding_disabled = 1

" Vim-Clang-Format Configs
" ------------------------
augroup clang_format
    autocmd!

    autocmd FileType c,cpp,objc nnoremap <buffer><Leader>cf :<C-u>ClangFormat<CR>
    autocmd FileType c,cpp,objc vnoremap <buffer><Leader>cf :ClangFormat<CR>
augroup END

" Emmet Configs
" -------------
" remap emmet leader (the actual leader (trailing ',')
" still needs to be added)
let g:user_emmet_leader_key='<C-D>'

" YCM Configs
" -----------
" set path to extra configs (including compiler flags)
let g:ycm_global_ycm_extra_conf = '~/dotfiles/.ycm_extra_conf.py'

" haskell language server requires haskell-ide-engine to be installed
" see https://github.com/ycm-core/YouCompleteMe/issues/3122
let g:ycm_language_server = [
    \ {
        \ 'name': 'haskell',
        \ 'filetypes': [ 'haskell', 'hs', 'lhs' ],
        \ 'cmdline': [ 'hie-wrapper', '--lsp' ],
        \ 'project_root_files': [ '.stack.yaml', 'cabal.config', 'package.yaml' ]
    \ }
\ ]

" Toggle diagnostics for c files (disabled by default), this only
" works if the server is restarted every time the variable is changed.
" Restarting the server is actually very fragile and fails often.
" In large C projects (glibc, linux kernel, some others), it is
" probably best to not use YCM at all.
function! ToggleYCMDiagnostics()
    if g:ycm_show_diagnostics_ui ==# 1
        let g:ycm_show_diagnostics_ui = 0
    else
        let g:ycm_show_diagnostics_ui = 1
    endif
endfunction

let g:ycm_max_diagnostics_to_display = 50
let g:ycm_show_diagnostics_ui = 0
nnoremap <leader>yy :<C-U>call ToggleYCMDiagnostics()<CR>:<C-U>YcmRestartServer<CR>
let g:ycm_filetype_specific_completion_to_disable = {}
"\   'typescript': 0
"\}

" Coc Configs
" -----------
" highlights, NOTE: this doesn't really work (didn't bother to fix it)
highlight CocErrorSign ctermfg=Red ctermbg=Black
highlight CocWarningSign ctermfg=Yellow ctermbg=Blue

" enable autocompletion on tab
set completeopt=longest,menuone

" Use tab for trigger completion with characters ahead and navigate.
" NOTE: Use command ':verbose imap <tab>' to make sure tab is not mapped by
" other plugin before putting this into your config.
inoremap <silent><expr> <TAB>
      \ pumvisible() ? "\<C-n>" :
      \ <SID>check_back_space() ? "\<TAB>" :
      \ coc#refresh()
inoremap <expr><S-TAB> pumvisible() ? "\<C-p>" : "\<C-h>"

function! s:check_back_space() abort
  let col = col('.') - 1
  return !col || getline('.')[col - 1]  =~# '\s'
endfunction

" Use <c-space> to trigger completion.
if has('nvim')
  inoremap <silent><expr> <c-space> coc#refresh()
else
  inoremap <silent><expr> <c-@> coc#refresh()
endif

" Use <cr> to confirm completion, `<C-g>u` means break undo chain at current
" position. Coc only does snippet and additional edit on confirm.
" <cr> could be remapped by other vim plugin, try `:verbose imap <CR>`.
if exists('*complete_info')
  inoremap <expr> <cr> complete_info()["selected"] != "-1" ? "\<C-y>" : "\<C-g>u\<CR>"
else
  inoremap <expr> <cr> pumvisible() ? "\<C-y>" : "\<C-g>u\<CR>"
endif

" Vimtex
" ------
let g:tex_flavor = 'latex'

" haskell-vim Configs
" -------------------
let g:haskell_enable_quantification = 1   " to enable highlighting of `forall`
let g:haskell_enable_recursivedo = 1      " to enable highlighting of `mdo` and `rec`
let g:haskell_enable_arrowsyntax = 1      " to enable highlighting of `proc`
let g:haskell_enable_pattern_synonyms = 1 " to enable highlighting of `pattern`
let g:haskell_enable_typeroles = 1        " to enable highlighting of type roles
let g:haskell_enable_static_pointers = 1  " to enable highlighting of `static`
let g:haskell_backpack = 1                " to enable highlighting of backpack keywords

" Vim Racer Configs
" -----------------
" `hidden' mode for buffers helps with goto definitions
set hidden

" only require if not in path (only as a fallback)
let g:racer_cmd = '~/.cargo/bin/racer'

" experimental completer for full function definitions
let g:racer_experimental_completer = 1

" plugin mappings for seeing definitions and docs
" ALWAYS use <leader> with `r' mappings to be able
" to use regular replace with `r' i normal mode
augroup rust_lang
    autocmd!

    autocmd FileType rust nmap gd <Plug>(rust-def)
    autocmd FileType rust nmap gs <Plug>(rust-def-split)
    autocmd FileType rust nmap gx <Plug>(rust-def-vertical)
    autocmd FileType rust nmap <leader>rd <Plug>(rust-doc)
augroup END

" Git Gutter Configs
" ------------------
" enable by default, toggle with <leader>d
let g:gitgutter_enabled = 1
nnoremap <silent> <leader>d :GitGutterToggle<cr>

" Vim Go Configs
" --------------
" set `goimports' to be used to format src files
let g:go_fmt_command = 'goimports'

" add golang linter path to runtime path
set runtimepath+=$GOPATH/src/github.com/golang/lint/misc/vim

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

augroup go_lang
    autocmd!

    " build go files automatically with <leader>b, toggle test coverage
    " profile with <leader>c and call go-info with <leader>i
    autocmd FileType go nmap <leader>b :<C-u>call <SID>build_go_files()<CR>
    autocmd FileType go nmap <Leader>c <Plug>(go-coverage-toggle)
    autocmd FileType go nmap <Leader>i <Plug>(go-info)
augroup END

" some optional go syntax highlighting
"let g:go_highlight_function_calls = 1
"let g:go_highlight_operators = 1
let g:go_highlight_types = 1
let g:go_highlight_fields = 1
let g:go_highlight_functions = 1
let g:go_highlight_extra_types = 1
let g:go_highlight_build_constraints = 1
let g:go_highlight_generate_tags = 1

" automatically display go info
let g:go_auto_type_info = 1
set updatetime=300

" automatically highlight matching identifiers
let g:go_auto_sameids = 1

" Ale Configs
" -----------
" enable highlighting of linter findings
let g:ale_set_highlights = 1

" change the error and warning signs ale uses
let g:ale_sign_warning = '* '
let g:ale_sign_error = '? '

" re-format the error messages
let g:ale_echo_msg_format = '[%linter%] %s'

" Only run linting and fix files when saving them, not
" when text changes. Every buffer is checked when opened,
" too. Completions are enabled when available.
let g:ale_lint_on_text_changed = 'never'
let g:ale_lint_on_enter = 1
let g:ale_fix_on_save = 1
let g:ale_completion_enabled = 1

" enable auto-completion using github.com/maralla/completor.vim
let g:completor_gocode_binary = '~/code/go_src/src/github.com/nsf/gocode/'
let g:completor_python_binary = '/usr/bin/python3'

" set linters and fixers
" This requires the respective linters to be installed,
" most of them have pretty good instructions on GitHub, though.
" Start here: https://github.com/w0rp/ale or
" here: https://github.com/w0rp/ale/blob/master/supported-tools.md.
" Usually, tools only need to be installed to work without
" additional settings in this file. Some language configs are set
" manually, anyways.
" NOTE: tslint is sometimes slow, the same is true for clangtidy
let g:ale_linters = {
\   'typescript': ['tslint'],
\   'javascript': ['prettier', 'eslint', 'jshint'],
\   'python': ['flake8', 'mypy'],
\   'go': ['go', 'golint', 'errcheck'],
\   'vim': ['vint'],
\   'elm': ['elm_ls'],
\   'cpp': ['clang'],
\   'cc': ['clang']
\}

let g:ale_cpp_clang_options = '-Wall -Wextra -std=c++20 -x c++'
let g:ale_cpp_clangtidy_options = '-Wall -Wextra -std=c++20 -x c++'
let g:ale_cpp_clangcheck_options = '-- -Wall -Wextra -std=c++20 -x c++'
let g:ale_c_clangtidy_options = '-Wall -Wextra -std=c99 -x c'
let g:ale_c_clangcheck_options = '-- -Wall -Wextra -std=c99 -x c'

let g:ale_elm_ls_use_global = 1
let g:ale_elm_ls_executable = '/usr/local/bin/elm-language-server'
let g:ale_elm_ls_elm_analyse_trigger = 'change'
let g:ale_elm_ls_elm_path = '/usr/local/bin/elm'
let g:ale_elm_ls_elm_format_path = '/home/daniel/.local/bin/elm-format'
let g:ale_elm_ls_elm_test_path = '/home/daniel/.local/bin/elm-test'

let g:ale_glsl_glslang_executable = '/usr/bin/glslangValidator'

let g:ale_fixers = {
\   'json': ['prettier'],
\   'python': ['isort', 'autopep8'],
\   'elm': ['elm-format']
\}

" Using `prettier' as a fixer can be annoying, e.g. when writing jsx. If
" that is the case, just toggle running fixers on save with <leader>j.
function! ToggleAleFixers()
    if g:ale_fix_on_save ==# '1'
        let g:ale_fix_on_save = 0
    else
        let g:ale_fix_on_save = 1
    endif
endfunction

nnoremap <leader>j :<C-U>call ToggleAleFixers()<CR>

" go to the next ale warning/error with <leader>a
nmap <silent> <leader>a <Plug>(ale_next_wrap)

" check if the current working dir is part of a list of
" exceptions for which linting should be turned off by default
" (e.g. large repos like the linux kernel where header files
" are often not found -> those errors are annoying)
function! s:CheckWorkingDir() abort
    let l:is_kernel = expand('%:p:h') =~? '/kernel/'
    let l:is_linux = expand('%:p:h') =~? '/linux/'
    if l:is_kernel || l:is_linux
        echo 'Turning linting off for ' . expand('%:p:h') . '.'
        :ALEDisable
    endif
endfunction
augroup ale_disable_on_startup
    autocmd!
    autocmd VimEnter * call s:CheckWorkingDir()
augroup END

" Omni Complete Config
" --------------------
augroup css_lang
    autocmd!

    autocmd FileType css set omnifunc=csscomplete#CompleteCSS
augroup END

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
" Set a non-default color scheme. To get the dark solarized color scheme, the
" block below (resetting background, hightlights, etc.) is required, too!
" solarized: colorscheme solarized
colorscheme gruvbox
set background=dark
highlight Normal ctermbg=None
highlight nonText ctermbg=None
highlight clear LineNr
highlight clear CursorLineNr
highlight clear SignColumn
highlight GitGutterAdd ctermfg=green
highlight GitGutterChange ctermfg=yellow
highlight GitGutterDelete ctermfg=red
highlight GitGutterChangeDelete ctermfg=yellow
highlight ALEErrorSign ctermfg=red
highlight ALEWarningSign ctermfg=red

highlight link CocErrorSign ALEErrorSign
highlight link CocWarningSign ALEWarningSign
highlight link CocInfoSign ALEWarningSign
highlight link ALEInfoSign ALEWarningSign
highlight link CocDiagnosticsError Normal
highlight link CocDiagnosticsWarning Normal
highlight link CocDiagnosticsInfo Normal
highlight link CocSelectedText Normal
highlight link CocErrorVirtualText Normal
highlight link CocWarningVirtualText Normal
highlight link CocInfoVirtualText Normal
highlight link cError Normal

" toggle a color column to visualize a line width of 80 chars with <leader>cc
function! ToggleColorColumn()
    if &colorcolumn ==# 80
        set colorcolumn=
    else
        set colorcolumn=80
        highlight ColorColumn ctermbg=0
        highlight OverLength ctermfg=white
        match OverLength /\%81v.\+/
    endif
endfunction

nnoremap <leader>cc :<C-U>call ToggleColorColumn()<CR>

"********************************"
"** File Type Specific Configs **"
"********************************"
" Python
let python_highlight_all = 1
augroup python_lang
    autocmd!

    autocmd FileType python syn keyword pythonDecorator True None False self
    autocmd BufNewFile,BufRead *.jinja set syntax=htmljinja
    autocmd FileType python map <buffer> F :set foldmethod=indent<cr>
    autocmd FileType python inoremap <buffer> $r return
    autocmd FileType python inoremap <buffer> $i import
    autocmd FileType python inoremap <buffer> $p print
    autocmd FileType python inoremap <buffer> $f # --- <esc>a
    autocmd FileType python map <buffer> <leader>1 /class
    autocmd FileType python map <buffer> <leader>2 /def
    autocmd FileType python map <buffer> <leader>C ?class
    autocmd FileType python map <buffer> <leader>D ?def
    autocmd FileType python set cindent
    autocmd FileType python set cinkeys-=0#
    autocmd FileType python set indentkeys-=0#
    " unlink python space error highlighting
    hi link pythonSpaceError Normal
augroup END

" JavaScript
augroup javascript_lang
    autocmd!

    autocmd FileType javascript setl fen
    autocmd FileType javascript setl nocindent
    autocmd FileType javascript imap <c-t> $log();<esc>hi
    autocmd FileType javascript imap <c-a> alert();<esc>hi
    autocmd FileType javascript inoremap <buffer> $r return
    autocmd FileType javascript inoremap <buffer> $f // --- PH<esc>FP2xi
augroup END

" Additional syntax highlighting
augroup adv_syntax_hi
    autocmd!
    autocmd Syntax * syn match MyToDo /\v<(TODO|FIXME|XXX|NOTE|OPTIMIZE)/
        \ containedin=.*Comment,vimCommentTitle
augroup END

highlight def link MyToDo Todo
" highlight `TODO' and so forth in comments
autocmd Syntax * syntax keyword MyToDo NOTE TODO INCOMPLETE NOCHECKIN containedin=.*Comment.*
highlight clear Todo

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

" Don't close window when deleting a buffer
command! Bclose call <SID>BufcloseCloseIt()
function! <SID>BufcloseCloseIt()
    let l:currentBufNum = bufnr('%')
    let l:alternateBufNum = bufnr('#')

    if buflisted(l:alternateBufNum)
        buffer #
    else
        bnext
    endif

    if bufnr('%') == l:currentBufNum
        new
    endif

    if buflisted(l:currentBufNum)
        execute('bdelete! '.l:currentBufNum)
    endif
endfunction

function! CmdLine(str)
    call feedkeys(':' . a:str)
endfunction

function! VisualSelection(direction, extra_filter) range
    let l:saved_reg = @"
    execute 'normal! vgvy'

    let l:pattern = escape(@", "\\/.*'$^~[]")
    let l:pattern = substitute(l:pattern, "\n$", '', '')

    if a:direction ==? 'gv'
        call CmdLine("Ack '" . l:pattern . "' " )
    elseif a:direction ==? 'replace'
        call CmdLine('%s' . '/'. l:pattern . '/')
    endif

    let @/ = l:pattern
    let @" = l:saved_reg
endfunction

function! CurrentFileDir(cmd)
    return a:cmd . ' ' . expand('%:p:h') . '/'
endfunc

" Pascal / Delphi
if (1==1) " change to 1==0 to use original syntax
  au BufNewFile,BufRead *.pas,*.PAS set ft=delphi
else
  au BufNewFile,BufRead *.pas,*.PAS set ft=pascal
endif
" Delphi project file
au BufNewFile,BufRead *.dpr,*.DPR set ft=delphi
" Delphi form file
au BufNewFile,BufRead *.dfm,*.DFM set ft=delphi
au BufNewFile,BufRead *.xfm,*.XFM set ft=delphi
" Delphi package file
au BufNewFile,BufRead *.dpk,*.DPK set ft=delphi
" Delphi .BPG = Makefile
au BufNewFile,BufRead *.bpg,*.BPG set ft=make|setlocal makeprg=make\ -f\ %
