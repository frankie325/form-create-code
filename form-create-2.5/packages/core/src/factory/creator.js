import extend from '@form-create/utils/lib/extend';
import is from '@form-create/utils/lib/type';
import {attrs} from '../frame/attrs';
import {copyRule, mergeRule} from '../frame/util';
import {$set} from '@form-create/utils/lib/modify';

// 最基本的rule配置
export function baseRule() {
    return {
        props: {},
        on: {},
        options: [],
        children: [],
        hidden: false,
        display: true,
        value: undefined,
    };
}

export function creatorFactory(name, init) {
    return (title, field, value, props = {}) => {
        // 创建Creator实例，name为组件名称
        const maker = new Creator(name, title, field, value, props);
        if (init) {
            if (is.Function(init)) init(maker);
            else maker.props(init);
        }
        return maker;
    };
}

// Creator类，用来创建rule规则
export default function Creator(type, title, field, value, props) {
    this._data = extend(baseRule(), {type, title, field, value, props: props || {}});
    this.event = this.on;
}

extend(Creator.prototype, {
    // 得到生成rule
    getRule() {
        return this._data;
    },
    setProp(key, value) {
        $set(this._data, key, value);
        return this;
    },
    _clone() {
        const clone = new this.constructor();
        clone._data = copyRule(this._data);
        return clone;
    },
})

/*
生成修改属性的方法，比如后面的.props：
formCreate.maker.input('title','field','value').props({disabled:true})
*/ 
export function appendProto(attrs) {
    attrs.forEach(name => {
        Creator.prototype[name] = function (key) {
            // 合并设置的属性
            mergeRule(this._data, {[name]: arguments.length < 2 ? key : {[key]: arguments[1]}})
            return this;
        };
    });
}

appendProto(attrs());
