import {$set} from './modify';

const _extends = Object.assign || function (a) {
    // 从第二个参数开始遍历
    for (let b, c = 1; c < arguments.length; c++) {
        // 遍历对象，拷贝到a对象中
        for (let d in b = arguments[c], b) {
            Object.prototype.hasOwnProperty.call(b, d) && ($set(a, d, b[d]));
        }
    }
    return a;
}

// 将第二个参数后的对象拷贝到第一个参数的对象中
export default function extend() {
    return _extends.apply(this, arguments);
}

export function copy(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    return obj instanceof Array ? [...obj] : {...obj};
}
