import $FormCreate from '../components/formCreate';
import Vue from 'vue';
import makerFactory from '../factory/maker';
import Handle from '../handler';
import fetch from './fetch';
import {creatorFactory} from '..';
import BaseParser from '../factory/parser';
import {copyRule, copyRules, mergeGlobal, parseJson, toJson, parseFn} from './util';
import fragment from '../components/fragment';
import is from '@form-create/utils/lib/type';
import toCase from '@form-create/utils/lib/tocase';
import extend from '@form-create/utils/lib/extend';
import {CreateNodeFactory} from '../factory/node';
import {createManager} from '../factory/manager';
import {arrayAttrs, keyAttrs, normalAttrs} from './attrs';
import {appendProto} from '../factory/creator';
import $fetch from './provider';
import {deepCopy} from '@form-create/utils/lib/deepextend';

export let _vue = typeof window !== 'undefined' && window.Vue ? window.Vue : Vue;

function _parseProp(name, id) {
    // arguments = ["name", {name:"str",init(){},...}]
    let prop;
    if (arguments.length === 2) {
        prop = arguments[1];
        id = prop[name];
    } else {
        prop = arguments[2];
    }

    /*
        返回一个对象
        {
            id:"str",
            prop:{
                name:"str",
                init(){},
                ...
            }
        }
    */
    return {id, prop};
}

/*
    以register({name:"str",init(){},...})为例

    arguments = [
        { name:"str",init(){},... }
    ]

*/
function nameProp() {
    return _parseProp('name', ...arguments);
}

function _getEl(options) {
    if (!options || !options.el) return window.document.body;
    return is.Element(options.el)
        ? options.el
        : document.querySelector(options.el);
}

// 创建一个vue实例，该vue实例就是form-create组件，并执行空挂载
function mountForm(rules, option) {
    const $vm = new _vue({
        data() {
            //todo 外部无法修改
            return {rule: rules, option: option || {}};
        },
        render(h) {
            // 在create.install这一步已经注册了form-create组件
            return h('FormCreate', {ref: 'fc', props: this.$data});
        }
    });
    $vm.$mount();
    return $vm;
}

function exportAttrs(attrs) {
    const key = attrs.key || [];
    const array = attrs.array || [];
    const normal = attrs.normal || [];
    keyAttrs.push(...key);
    arrayAttrs.push(...array);
    normalAttrs.push(...normal);

    appendProto([...key, ...array, ...normal]);
}

//todo 表单嵌套
export default function FormCreateFactory(config) {

    const components = {
        [fragment.name]: fragment
    };
    const parsers = {};
    const directives = {};
    const providers = {
        fetch: $fetch
    };
    const maker = makerFactory();
    let globalConfig = {global: {}};
    const data = {};
    const CreateNode = CreateNodeFactory();

    exportAttrs(config.attrs || {});

    function directive() {
        const data = nameProp(...arguments);
        if (data.id && data.prop) directives[data.id] = data.prop;
    }

    // 注册自定义属性  用户通过create.register({name:"str",init(){},...})调用
    // 以register({name:"str",init(){},...})为例
    function register() {
        const data = nameProp(...arguments);
        /*
        data为
        {
            id:"str",
            prop:{
                name:"str",
                init(){},
                ...
            }
        }
        添加到providers对象
        {
            str: {
                name:"str",
                init(){},
                ...
            }
        }
        */
        if (data.id && data.prop) providers[data.id] = {...data.prop, name: data.id};
    }

    function componentAlias(alias) {
        CreateNode.use(alias);
    }

    function parser() {
        const data = nameProp(...arguments);
        if (!data.id || !data.prop) return;
        const name = toCase(data.id);
        const parser = data.prop;
        const base = parser.merge === true ? parsers[name] : undefined;
        parsers[name] = {...(base || BaseParser), ...parser};
        maker[name] = creatorFactory(name);
        parser.maker && extend(maker, parser.maker);
    }

    function component(id, component) {
        let name;
        if (is.String(id)) {
            name = toCase(id);
            if (['form-create', 'formcreate'].indexOf(name) > -1) {
                return $form();
            } else if (component === undefined) {
                return components[name];
            }
        } else {
            name = toCase(id.name);
            component = id;
        }
        if (!name || !component) return;
        components[name] = component;
        if (component.formCreateParser) parser(name, component.formCreateParser);
    }

    

    function $vnode() {
        return _vue.extend(fragment);
    }

    //todo 检查回调函数作用域
    function use(fn, opt) {
        if (is.Function(fn.install)) fn.install(create, opt);
        else if (is.Function(fn)) fn(create, opt);
        return this;
    }

    function factory() {
        return FormCreateFactory(config);
    }

    function FormCreate(vm, rules, options) {
        extend(this, {
            vm, //form-create组件实例
            create,
            manager: createManager(config.manager), /*config.manager是一个对象，为用到的一些方法，createManager创建Manager类*/
            parsers,
            providers,
            rules: Array.isArray(rules) ? rules : [],
            prop: {
                components,
                directives,
            },
            CreateNode,
            bus: new _vue,
            unwatch: null,
            extendApi: config.extendApi || (api => api)  //方法，可以将iview的api合并到核心api
        })
        this.init();
        this.initOptions(options || {});
    }

    extend(FormCreate.prototype, {
        // 初始化
        init() {
            const vm = this.vm;
            const h = new Handle(this); //创建handler实例
            this.$handle = h;
            vm.$f = h.api; //api接口
            vm.$emit('input', h.api); //设置form-create组件v-model

            // hook钩子，在form-create组件created执行时调用
            vm.$on('hook:created', () => {
                if (this.isSub()) { // 如果是嵌套子表单

                    // 监听父级option配置的改变
                    this.unwatch = vm.$watch(() => vm.$pfc.option, () => {
                        this.initOptions(this.options);
                        vm.$f.refresh(); //刷新表单渲染
                    }, {deep: true});
                    this.initOptions(this.options);
                }
                this.created();
            })
            vm.$on('hook:mounted', () => {
                this.mounted();
            });
            vm.$on('hook:beforeDestroy', () => {
                vm.destroyed = true;
                this.unwatch && this.unwatch();
                h.reloadRule([]);
            });
            vm.$on('hook:updated', () => {
                h.bindNextTick(() => this.bus.$emit('next-tick', h.api));
            });
        },
        // 如果是嵌套子表单
        isSub() {
            return this.vm.$pfc && this.vm.extendOption;
        },

        // 
        initOptions(options) {
            this.options = {formData: {}, submitBtn: {}, resetBtn: {}, ...deepCopy(globalConfig)};
            if (this.isSub()) {
                // 如果是嵌套子表单，
                this.mergeOptions(this.options, this.vm.$pfc.$f.config || {}, true);
            }
            this.updateOptions(options);
        },
        mergeOptions(target, opt, parent) {
            opt = deepCopy(opt);
            parent && ['page', 'onSubmit', 'mounted', 'reload', 'formData', 'el'].forEach((n) => {
                delete opt[n];
            });
            if (opt.global) {
                target.global = mergeGlobal(target.global, opt.global);
                delete opt.global;
            }
            this.$handle.$manager.mergeOptions([opt], target);
            return target;
        },
        updateOptions(options) {
            this.mergeOptions(this.options, options);
            this.$handle.$manager.updateOptions(this.options);
        },
        // 在form-create组件created执行时调用
        created() {
            this.$handle.init();
            this.vm.$emit('created', this.api()); //触发form-create组件上绑定的created钩子
        },
        api() {
            return this.$handle.api;
        },
        render() {
            return this.$handle.render();
        },
        mounted() {
            this.$handle.mounted();
        },
    })


    // 往目标对象中添加下列属性
    function useAttr(formCreate) {
        extend(formCreate, {
            version: config.version,
            ui: config.ui,
            data,
            maker,
            component,
            directive,
            register,
            $vnode,
            parser,
            use,
            factory,
            componentAlias,
            copyRule,
            copyRules,
            fetch,
            $form,
            parseFn,
            parseJson,
            toJson,
            init(rules, _opt = {}) {
                let $vm = mountForm(rules, _opt), _this = $vm.$refs.fc.formCreate;
                return {
                    mount($el) {
                        if ($el && is.Element($el))
                            _this.options.el = $el;
                        _getEl(_this.options).appendChild($vm.$el);
                        return _this.api();
                    },
                    remove() {
                        $vm.$el.parentNode && $vm.$el.parentNode.removeChild($vm.$el);
                    },
                    destroy() {
                        this.remove();
                        $vm.$destroy();
                    },
                    $f: _this.api()
                };
            }
        });
    }
    
    function $form() {
        // $FormCreate调用，返回form-create组件配置，调用Vue.extend返回form-create组件的构造函数
        return _vue.extend($FormCreate(FormCreate));
    }

    function useStatic(formCreate) {
        extend(formCreate, {
            create,

            // *****入口处执行该方法，或者Vue.use()执行该方法,options为Vue.use()传递的其余参数*****
            install(Vue, options) {
                globalConfig = {...globalConfig, ...(options || {})}
                if (Vue._installedFormCreate === true) return;
                Vue._installedFormCreate = true;
                _vue = Vue;

                const $formCreate = function (rules, opt = {}) {
                    // 又执行create方法
                    return create(rules, opt, this);
                };

                useAttr($formCreate);

                Vue.prototype.$formCreate = $formCreate; //方式1：通过Vue原型调用生成form-create，this.$formCreate(rule, opt)
                Vue.component('FormCreate', $form());   //方式2：直接进行组件注册，$form()执行为form-create组件的构造函数
                Vue.component('FcFragment', $vnode()); 
            }
        })
    }

     // FormCreateFactory工厂函数，导出create方法
     function create(rules, _opt, parent) {
        //  创建该vue实例，也就是form-create组件外包裹的一层vue实例
        let $vm = mountForm(rules, _opt || {});
        // 拿到FormCreate实例
        const _this = $vm.$refs.fc.formCreate;
        _this.$parent = parent;
        // 添加option.el指定的DOM元素里
        _getEl(_this.options).appendChild($vm.$el);
        return _this.api();
    }

    useAttr(create);
    useStatic(create);

    CreateNode.use({fragment: 'fcFragment'});

    if (config.install) create.use(config);

   

    return create;
}
