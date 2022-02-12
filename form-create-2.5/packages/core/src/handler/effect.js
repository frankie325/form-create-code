import extend from '@form-create/utils/lib/extend';
import is, {hasProperty} from '@form-create/utils/lib/type';
import mergeProps from '@form-create/utils/lib/mergeprops';


export default function useEffect(Handler) {
    extend(Handler.prototype, {
        /*
            const $fetch = {
                name: 'fetch',
                loaded(...args) {
                    run(...args);
                },
                watch(inject, rule, api) {
                    if (!run(inject, rule, api)) {
                        inject.clearProp();
                        api.sync(rule);
                    }
                }
            };
            providers = {
                fetch: $fetch, 
                str: {
                    name:"str",
                    //属性绑定的组件,不设置或者'*'默认为全部组件
                    components: "*",
                    init(){},
                    ...
                }
            }
            providers为用户注册的自定义属性
        */
        useProvider() {
            const ps = this.fc.providers; //
            Object.keys(ps).forEach(k => {
                const prop = ps[k];
                prop._c = getComponent(prop); //获取属性绑定的组件，为数组
                this.onEffect(prop);
                this.providers[k] = prop;
            });
        },
        onEffect(provider) {
            const used = [];
            (provider._c || ['*']).forEach(name => {
                /*
                    拿到components中对应的组件名称，比如components指定为["button"]
                    则type为iButton
                */ 
                const type = name === '*' ? '*' : this.getType(name);
                if (used.indexOf(type) > -1) return;
                used.push(type); 

                /*
                    绑定事件到中央事件总线
                */ 
                this.bus.$on(`p:${provider.name}:${type}:${provider.input ? 1 : 0}`, (event, args) => {
                    provider[event] && provider[event](...args); //触发provider中对应的方法
                });
            });
            provider._used = used; //保存了components中对应的组件名称
        },
        watchEffect(ctx) {
            const vm = this.vm;
            Object.keys(ctx.rule.effect || {}).forEach(k => {
                ctx.watch.push(vm.$watch(() => ctx.rule.effect[k], (n) => {
                    this.effect(ctx, 'watch', {[k]: n});
                }, {deep: true}));
            });
        },
        /**
         * @description: 
         * @param {*} rule  rule规则
         * @param {String} event 自定义属性中的方法
         * @param {*} append
         * @return {*}
         */        
        ruleEffect(rule, event, append) {
            this.emitEffect({
                rule,
                input: !!rule.field, //表示rule.field字段是否存在
                type: this.getType(rule.type)
            }, event, append);
        },
        effect(ctx, event, custom) {
            this.emitEffect({
                rule: ctx.rule,
                input: ctx.input,
                type: ctx.trueType,
                ctx,
                custom
            }, event);
        },
        // 获取自定义属性的值
        getEffect(rule, name) {
            // 如果rule.effect存在，则返回effect中对应的值
            if (hasProperty(rule, 'effect') && hasProperty(rule.effect, name))
                return rule.effect[name];
            else
                return undefined;
        },
        emitEffect({ctx, rule, input, type, custom}, event, append) {
            if (!type || type === 'fcFragment') return;
            const effect = custom ? custom : (rule.effect || {}); //拿到rule.effect
            Object.keys(effect).forEach(attr => { //遍历effect的key值
                const p = this.providers[attr]; //从providers找到该键值
                if (!p || (p.input && !input)) return;

                let _type;
                if (!p._c) {
                    // 如果没有定义components属性，则为*
                    _type = '*';
                } else if (p._used.indexOf(type) > -1) {
                    // 如果type存在于_u，则使用该type
                    _type = type;
                } else {
                    return;
                }

                const data = {value: effect[attr], getValue: () => this.getEffect(rule, attr), ...(append || {})};

                if (ctx) {
                    data.getProp = () => ctx.effectData(attr);
                    data.clearProp = () => ctx.clearEffectData(attr);
                    data.mergeProp = (prop) => mergeProps([prop], data.getProp());
                }

                // 触发provider中对应的方法
                this.bus.$emit(`p:${attr}:${_type}:${p.input ? 1 : 0}`, event, [data, rule, this.api]);
            });
        }
    });
}

// 数组去重
function unique(arr) {
    return arr.filter(function (item, index, arr) {
        return arr.indexOf(item, 0) === index;
    });
}

//获取属性绑定的组件，为数组
function getComponent(p) {
    const c = p.components;
    if (Array.isArray(c)) return unique(c.filter(v => v !== '*'));
    else if (is.String(c)) return [c];
    else return false;
}
