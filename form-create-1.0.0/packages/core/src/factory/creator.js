/*
 * @Author: your name
 * @Date: 2022-01-30 16:24:27
 * @LastEditTime: 2022-01-31 16:45:00
 * @LastEditors: Please set LastEditors
 * @Description: 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 * @FilePath: \code\form-create-1.0.0\packages\core\src\factory\creator.js
 */
import {$set, extend, isFunction, isPlainObject} from '@form-create/utils';
import VData from './vData';

function baseRule() {
    return {
        validate: [],
        options: [],
        col: {},
        children: [],
        emit: [],
        template: undefined,
        emitPrefix: undefined,
        native: undefined,
        info: undefined,
    };
}

// 创建FormCreate.maker.input等方法
export function creatorFactory(name) {
    return (title, field, value, props = {}) => new Creator(name, title, field, value, props);
}

/*
比如input由多种类型，creatorTypeFactory用来创建对应的maker方法
maker.password('密码', 'password', 123),
*/ 
export function creatorTypeFactory(name, type, typeName = 'type') {
    return (title, field, value, props = {}) => {
        const maker = new Creator(name, title, field, value, props);
        if (isFunction(type)) type(maker);
        else maker.props(typeName, type);
        return maker;
    };
}

// Creator类继承自VData
export default class Creator extends VData {
    constructor(type, title, field, value, props = {}) {
        super();
        extend(this._data, baseRule());
        extend(this._data, {type, title, field, value});
        if (isPlainObject(props)) this.props(props);
    }

    type(type) {
        this.props('type', type);
        return this;
    }

    getRule() {
        return this._data;
    }

    event(...args) {
        this.on(...args);
        return this;
    }
}

// 下面这些都是设置对应的属性到this._data中
const keyAttrs = ['emitPrefix', 'className', 'value', 'name', 'title', 'native', 'info'];

keyAttrs.forEach(attr => {
    Creator.prototype[attr] = function (value) {
        $set(this._data, attr, value);
        return this;
    };
});

const objAttrs = ['col'];

objAttrs.forEach(attr => {
    Creator.prototype[attr] = function (opt) {
        $set(this._data, attr, extend(this._data[attr], opt));
        return this;
    };
});

const arrAttrs = ['validate', 'options', 'children', 'emit'];

arrAttrs.forEach(attr => {
    Creator.prototype[attr] = function (opt) {
        if (!Array.isArray(opt)) opt = [opt];
        $set(this._data, attr, this._data[attr].concat(opt));
        return this;
    };
});
