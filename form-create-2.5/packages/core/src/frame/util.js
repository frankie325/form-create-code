import is from '@form-create/utils/lib/type';
import mergeProps from '@form-create/utils/lib/mergeprops';
import {arrayAttrs, normalAttrs} from './attrs';
import {logError} from '@form-create/utils/lib/console';
import {parseJson, toJson} from '@form-create/utils/lib/json';
import deepExtend from '@form-create/utils/lib/deepextend';

export {parseFn} from '@form-create/utils/lib/json';
export {parseJson, toJson}

// 定义不可配置，不可遍历的属性 
export function enumerable(value, writable) {
    return {
        value,
        enumerable: false,
        configurable: false,
        writable: !!writable
    }
}

//todo 优化位置
export function copyRule(rule) {
    return copyRules([rule])[0];
}

export function copyRules(rules, mode) {
    return deepExtend([], [...rules], mode || false);
}

// 合并rule
export function mergeRule(rule, merge) {
    mergeProps(Array.isArray(merge) ? merge : [merge], rule, {array: arrayAttrs, normal: normalAttrs});
    return rule;
}

// rule如果是由maker生成，则为creator实例，执行getRule方法，得到rule
export function getRule(rule) {
    return is.Function(rule.getRule) ? rule.getRule() : rule;
}

/*
 合并option.global
  global:{
    //设置 inputNumber 组件
    'inputNumber':{
      props:{
        disabled:true,
        precision:2
      },
      col:{
        span:12
      },
    }
  }
*/
export function mergeGlobal(target, merge) {
    if (!target) return merge;
    // 遍历global
    Object.keys(merge || {}).forEach((k) => {
        if (merge[k]) { //merge[k]就相当于rule
            target[k] = mergeRule(target[k] || {}, merge[k])
        }
    });
    return target;
}

//代理到目标对象
export function funcProxy(that, proxy) {
    Object.defineProperties(that, Object.keys(proxy).reduce((initial, k) => {
        initial[k] = {
            get() {
                return proxy[k]();
            }
        }
        return initial;
    }, {}))
}

export function byCtx(rule) {
    return rule.__fc__ || (rule.__origin__ ? rule.__origin__.__fc__ : null)
}

// 错误拦截，并执行该方法
export function invoke(fn, def) {
    try {
        def = fn()
    } catch (e) {
        logError(e);
    }
    return def;
}
