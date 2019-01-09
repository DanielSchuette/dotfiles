/* Terminal colors (16 first used in escape sequence) */
static const char *colorname[] = {

  /* 8 normal colors */
  [0] = "#282a2e", /* black   */
  [1] = "#a54242", /* red     */
  [2] = "#8c9440", /* green   */
  [3] = "#de935f", /* yellow  */
  [4] = "#5f819d", /* blue    */
  [5] = "#85678f", /* magenta */
  [6] = "#5e8d87", /* cyan    */
  [7] = "#707880", /* white   */

  /* 8 bright colors */
  [8]  = "#373b41", /* black   */
  [9]  = "#cc6666", /* red     */
  [10] = "#b5bd68", /* green   */
  [11] = "#f0c674", /* yellow  */
  [12] = "#81a2be", /* blue    */
  [13] = "#b294bb", /* magenta */
  [14] = "#8abeb7", /* cyan    */
  [15] = "#c5c8c6", /* white   */

  /* special colors */
  [256] = "#1d1f21", /* background */
  [257] = "#c5c8c6", /* foreground */
};

/*
 * Default colors (colorname index)
 * foreground, background, cursor
 */
static unsigned int defaultfg = 257;
static unsigned int defaultbg = 256;
static unsigned int defaultcs = 257;

/*
 * Colors used, when the specific fg == defaultfg. So in reverse mode this
 * will reverse too. Another logic would only make the simple feature too
 * complex.
 */
static unsigned int defaultitalic = 7;
static unsigned int defaultunderline = 7;
