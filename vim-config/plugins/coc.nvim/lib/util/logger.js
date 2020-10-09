"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const log4js_1 = tslib_1.__importDefault(require("log4js"));
const path_1 = tslib_1.__importDefault(require("path"));
const os_1 = tslib_1.__importDefault(require("os"));
function getLogFile() {
    let file = process.env.NVIM_COC_LOG_FILE;
    if (file)
        return file;
    let dir = process.env.XDG_RUNTIME_DIR;
    if (dir) {
        try {
            fs_1.default.accessSync(dir, fs_1.default.constants.R_OK | fs_1.default.constants.W_OK);
            return path_1.default.join(dir, `coc-nvim-${process.pid}.log`);
        }
        catch (err) {
            // noop
        }
    }
    dir = path_1.default.join(process.env.TMPDIR, `coc.nvim-${process.pid}`);
    if (os_1.default.platform() == 'win32') {
        dir = path_1.default.win32.normalize(dir);
    }
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    return path_1.default.join(dir, `coc-nvim.log`);
}
const MAX_LOG_SIZE = 1024 * 1024;
const MAX_LOG_BACKUPS = 10;
let logfile = getLogFile();
const level = process.env.NVIM_COC_LOG_LEVEL || 'info';
if (fs_1.default.existsSync(logfile)) {
    // cleanup if exists
    try {
        fs_1.default.writeFileSync(logfile, '', { encoding: 'utf8', mode: 0o666 });
    }
    catch (e) {
        // noop
    }
}
log4js_1.default.configure({
    disableClustering: true,
    appenders: {
        out: {
            type: 'file',
            mode: 0o666,
            filename: logfile,
            maxLogSize: MAX_LOG_SIZE,
            backups: MAX_LOG_BACKUPS,
            layout: {
                type: 'pattern',
                // Format log in following pattern:
                // yyyy-MM-dd HH:mm:ss.mil $Level (pid:$pid) $categroy - $message.
                pattern: `%d{ISO8601} %p (pid:${process.pid}) [%c] - %m`,
            },
        }
    },
    categories: {
        default: { appenders: ['out'], level }
    }
});
module.exports = (name = 'coc-nvim') => {
    let logger = log4js_1.default.getLogger(name);
    logger.getLogFile = () => logfile;
    return logger;
};
//# sourceMappingURL=logger.js.map