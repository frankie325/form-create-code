import {functionalMerge, normalMerge, toArrayMerge} from '@form-create/utils/lib/mergeprops';


export const keyAttrs = ['type', 'slot', 'emitPrefix', 'value', 'name', 'native', 'hidden', 'display', 'inject', 'options', 'emit', 'nativeEmit', 'link', 'prefix', 'suffix', 'update', 'sync', 'optionsTo', 'key'];

// rule配置中为数组的属性
export const arrayAttrs = ['validate', 'children', 'control'];

export const normalAttrs = ['effect', 'deep'];

// 创建creator实例时用到
export function attrs() {
    return [...keyAttrs, ...normalMerge, ...toArrayMerge, ...functionalMerge, ...arrayAttrs, ...normalAttrs];
}
