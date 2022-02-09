import {$set, extend, isPlainObject, isUndef, toArray, toString} from '@form-create/utils';

function defVData() {
    return {
        class: {},
        style: {},
        attrs: {},
        props: {},
        domProps: {},
        on: {},
        nativeOn: {},
        directives: [],
        scopedSlots: {},
        slot: undefined,
        key: undefined,
        ref: undefined
    };
}

// VData的作用是创建data，作为渲染函数的第二个参数
export default class VData {

    constructor() {
        this.init();
    }

    // 处理rule.class
    class(classList, status = true) {
        if (isUndef(classList)) return this;

        if (Array.isArray(classList)) { //如果是数组
            classList.forEach((cls) => {
                $set(this._data.class, toString(cls), true);
            });
        } else if (isPlainObject(classList)) { //如果是对象
            $set(this._data, 'class', extend(this._data.class, classList));
        } else { //如果字符
            $set(this._data.class, toString(classList), status === undefined ? true : status);
        }

        return this;
    }

    directives(directives) {
        if (isUndef(directives)) return this;
        $set(this._data, 'directives', this._data.directives.concat(toArray(directives)));
        return this;
    }

    // 初始化表单控件的属性
    init() {
        this._data = defVData();
        return this;
    }


    // 得到最终的_data，并重新初始化
    get() {
        const data = Object.keys(this._data).reduce((initial, key) => {
            const value = this._data[key];

            //遍历_data，过滤掉值不存在的，是数组但长度为0的，是空对象的
            if (value === undefined) return initial;
            if (Array.isArray(value) && !value.length) return initial;
            if (!Object.keys(value).length && key !== 'props') return initial;

            initial[key] = value;
            return initial;
        }, {});
        // 重新初始_data，为下一个调用VData实例方法做准备
        this.init();
        return data;
    }
}

const keyList = ['ref', 'key', 'slot']; //该属性的值为字符
const objList = ['scopedSlots', 'nativeOn', 'on', 'domProps', 'props', 'attrs', 'style'];//该属性的值为对象

// 遍历上述list，生成对应的方法

keyList.forEach(key => {
    VData.prototype[key] = function (val) {
        // 比如为key属性，则设置到_data.key = val 
        $set(this._data, key, val);
        return this;
    };
});

objList.forEach(key => {
    VData.prototype[key] = function (obj, val) {
        if (isUndef(obj)) return this; //不是对象则直接返回

        if (isPlainObject(obj)) {
            // 如果是对象，直接浅拷贝过来，并进行响应式处理
            $set(this._data, key, extend(this._data[key], obj));
        } else {
            /*
                如果不是对象
                比如调用vData.class(className, true)
                _data = {
                    class:{
                        className: true
                    }
                }
            */  
            $set(this._data[key], toString(obj), val);
        }

        return this;
    };
});

