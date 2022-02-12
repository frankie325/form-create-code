import extend from '@form-create/utils/lib/extend';
import is from '@form-create/utils/lib/type';
import toLine from '@form-create/utils/lib/toline';
import {parseFn} from '../frame/util';


export default function useInject(Handler) {
    extend(Handler.prototype, {
        // options.injectEvent表单配置，为true的话，所有事件都将注入参数
        /**
         * @description: 
         * @param {*} rule
         * @param {*} on 为rule.on、rule.props、rule.nativeOn、rule.deep这些属性
         * @return {*}
         */        
        parseInjectEvent(rule, on) {
            const inject = rule.inject || this.options.injectEvent; //是否开启注入参数
            return this.parseEventLst(rule, on, inject);
        },
        /*
            以rule.on为例
            {
                change: ()=>{},
                blur:[()=>{},...]
            }
        */ 
        parseEventLst(rule, data, inject, deep) {
            // 遍历rule.on
            Object.keys(data).forEach(k => {
                const fn = this.parseEvent(rule, data[k], inject, deep);
                // 重新赋值为注入参数后的方法
                if (fn) {
                    data[k] = fn;
                }
            });
            return data;
        },
        parseEvent(rule, fn, inject, deep) {
            if (is.Function(fn) && ((inject !== false && !is.Undef(inject)) || fn.__inject)) {
                // 如果是方法且inject为true，则生成注入参数后的方法
                return this.inject(rule, fn, inject)
            } else if (!deep && Array.isArray(fn) && fn[0] && (is.String(fn[0]) || is.Function(fn[0]))) {
                // 
                return this.parseEventLst(rule, fn, inject, true);
            } else if (is.String(fn)) {
                const val = parseFn(fn);
                if (val && fn !== val) {
                    return val.__inject ? this.parseEvent(rule, val, inject, true) : val;
                }
            }
        },
        /*
         使用emit配置，如下
         {
            type:'input',
            field:'inputField',
            title:'change 事件',
            emit:['change'],
            emit: [{
                name: 'change',
                inject: ['自定义参数,数据类型不限']
            }],
            emitPrefix:'prefix1'
         },
         <form-create @input-field-change="change"/>
         <form-create @prefix1-change="change"/>

         处理emit配置项，并生成注入了fApi,rule和自定义属性作为首参的事件对象
        */
        parseEmit(ctx, on) {
            // on为true，处理rule.emit，on为false处理rule.nativeEmit
            let event = {}, rule = ctx.rule, {emitPrefix, field, name, inject} = rule;
            
            // 拿到rule.emit / rule.nativeEmit
            let emit = rule[on ? 'emit' : 'nativeEmit'] || [];
            if (is.trueArray(emit)) { //如果是数组
                let emitKey = emitPrefix || field || name;
                if (emitKey) {
                    if (!on) emitKey = `native-${emitKey}`; //添加native-
                    emit.forEach(eventName => {
                        if (!eventName) return;
                        let eventInject;
                        if (is.Object(eventName)) { //如果是对象
                            eventInject = eventName.inject; //拿到注入的参数
                            eventName = eventName.name;
                        }
                        const fieldKey = toLine(`${emitKey}-${eventName}`); //进行拼接，生成事件名
                        // 创建事件函数
                        const fn = (...arg) => {
                            this.vm.$emit(fieldKey, ...arg);
                            this.vm.$emit('emit-event', fieldKey, ...arg);
                        };
                        fn.__emit = true;

                        // 如果没有设置rule.inject为true，则不会注入参数
                        if (!eventInject && inject === false) {
                            event[eventName] = fn;
                        } else {
                            // 拿到inject注入参数
                            let _inject = eventInject || inject || this.options.injectEvent;
                            // 如果设置了注入参数，则调用inject进行注入
                            event[eventName] = is.Undef(_inject) ? fn : this.inject(rule, fn, _inject);
                        }
                    });
                }

            }
            /*
                event为 
                {
                    change:()=>{},
                    blur:()=>{},
                    ...
                }
            */
            ctx.computed[on ? 'on' : 'nativeOn'] = event; //将event添加到RuleContext实例.computed上
            return event;
        },
        // 生成注入参数
        getInjectData(self, inject) {
            const {option, rule} = this.vm.$options.propsData; //form-create组件上绑定的option和rule

            return {
                api: this.api,
                $f: this.api,
                rule,
                self: self.__origin__,
                option,
                inject
            };
        },
        /**
         * @description: 生成注入参数后的方法
         * @param {*} self rule
         * @param {*} _fn 需要注入参数的方法
         * @param {*} inject 是否需要注入
         * @return {*}
         */        
        inject(self, _fn, inject) {
            // 如果__origin存在，直接使用__origin
            if (_fn.__origin) {
                if (this.watching && !this.loading)
                    return _fn;
                _fn = _fn.__origin;
            }

            const h = this;

            // 生成经过参数注入后的方法
            const fn = function (...args) {
                const data = h.getInjectData(self, inject); // 生成注入参数
                data.args = [...args]; 
                args.unshift(data); //将data作为第一个参数
                return _fn.apply(this, args);
            };
            fn.__origin = _fn; //__origin为原先的方法
            fn.__json = _fn.__json;
            return fn;
        },
    })
}
