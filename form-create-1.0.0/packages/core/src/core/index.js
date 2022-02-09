import {
    $set,
    deepExtend,
    extend,
    isBool,
    isElement,
    toString,
    isPlainObject,
} from '@form-create/utils';
import $FormCreate from '../components/formCreate';
import {formCreateName} from '../components/formCreate';
import Vue from 'vue';
import makerFactory from '../factory/maker';
import Handle from './handle';
import {creatorFactory} from '../factory/creator';
import BaseParser from '../factory/parser';
import {parseJson} from './util';

export let _vue = typeof window !== 'undefined' && window.Vue ? window.Vue : Vue;

export default function createFormCreate(drive) {

    /*
        maker：为对象，并定义了一系类方法
    */ 
    const components = {}, parsers = {}, maker = makerFactory(), globalConfig = drive.getConfig(), data = {};

    /*
        将表单控件对应的parser类添加到parsers对象中
        parsers = {
            checkbox:对应的parser类
        }

        添加一个函数（用来创建Creator实例）到FormCreate.maker对象中

        FormCreate.maker = {
            checkbox: (title, field, value, props = {}) => new Creator(name, title, field, value, props)
            ....
        }
        比如，当执行FormCreate.maker.input("姓名", name, kfg)时，则会
    */ 
    function setParser(id, parser) {
        id = toString(id);
        parsers[id.toLocaleLowerCase()] = parser;
        FormCreate.maker[id] = creatorFactory(id); //为一个函数，用来创建Creator实例
    }

    function createParser() {
        return class Parser extends BaseParser {
        }
    }

    // 用户注册自定义组件方法
    function component(id, component) {
        id = toString(id);
        const _id = id.toLocaleLowerCase();
        if (_id === 'form-create' || _id === 'formcreate')
            return get$FormCreate();
        if (component === undefined)
            return components[id];
        else
            components[id] = component;
    }

    // 合并到全局配置
    function margeGlobal(config, _options) {
        if (isBool(_options.sumbitBtn))
            _options.sumbitBtn = {show: _options.sumbitBtn};

        if (isBool(_options.resetBtn))
            _options.resetBtn = {show: _options.resetBtn};

        let options = deepExtend(config, _options);

        $set(options, 'el', !options.el
            ? window.document.body
            : (isElement(options.el)
                ? options.el
                : document.querySelector(options.el)
            ));

        return options;
    }

    // 得到form-create组件的构造函数
    function get$FormCreate() {
        // $FormCreate调动，为form-create组件配置，调用Vue.extend返回form-create组件的构造函数
        return _vue.extend($FormCreate(FormCreate, components));
    }

    function bindAttr(formCreate) {
        extend(formCreate, {
            version: drive.version,
            ui: drive.ui,
            maker, //绑定FormCreate.maker对象方法
            component, //绑定FormCreate.component组件注册方法
            setParser,
            createParser,
            data,
            // 用户调用：得到form-create组件的构造函数
            $form() {
                return get$FormCreate();
            },
            parseJson(json) {
                return parseJson(json);
            }
        });
    }

    // ****入口*****：安装插件
    function install(Vue, options) {
        // 设置Vue是否安装了form-create
        if (Vue._installedFormCreate === true) return;
        Vue._installedFormCreate = true;

        // 如果options存在是对象，合到全局配置
        if (options && isPlainObject(options))
            margeGlobal(globalConfig, options);
        
        // 注册插件，调用FormCreate.install
        Vue.use(FormCreate);
    }

    // 创建一个vue实例，该vue实例就是form-create组件，并执行空挂载
    function create(rules, option) {
        const $vm = new _vue({
            data() {
                // rules规则，和用户传递的配置opt
                return {rule: rules, option: isElement(option) ? {el: option} : option}; //传递opt可以直接是DOM元素，则用对象进行包裹
            },
            render() {
                return <form-create ref='fc' props={this.$data}/>
            }
        });
        $vm.$mount();
        return $vm;
    }

    class FormCreate {
        constructor(rules, options = {}) {
            this.fCreateApi = undefined;
            this.drive = drive;
            this.parsers = parsers;
            this.vm = undefined;
            this.rules = Array.isArray(rules) ? rules : [];
            this.options = margeGlobal(deepExtend({}, globalConfig), options); //全局配置和用户传递的配置合并
        }
        // from-create组件执行beforeCreate钩子时调用
        beforeCreate(vm) {
            this.vm = vm; //为form-create组件实例
            this.handle = new Handle(this); //创建Handle实例
        }
        // from-create组件执行created钩子时调用
        created() {
            this.handle.created();
        }

        // 得到初始化时注册的api
        api() {
            return this.handle.fCreateApi;
        }

        // from-create组件执行渲染函数时调用
        render() {
            return this.handle.run();
        }

        // from-create组件执行mounted钩子时调用
        mounted() {
            this.handle.mounted();
        }

        $emit(eventName, ...params) {
            if (this.$parent)
                this.$parent.$emit(`fc:${eventName}`, ...params);
            
            //执行form-create组件绑定的组件事件
            this.vm.$emit(eventName, ...params);
        }
        
        static create(rules, _opt = {}, parent) {

            let $vm = create(rules, _opt); // 创建一个vue实例，该vue实例render就是渲染form-create组件
 
            const _this = $vm.$refs.fc.formCreate; //拿到for-create组件
            _this.parent = parent;
            _this.options.el.appendChild($vm.$el); //将form-create添加到el指定的位置

            return _this.handle.fCreateApi;
        }


        static install(Vue) {
            /*
                 三种调用方式之一，通过vue实例调用，$f = this.$formCreate(rules, { 
                        //表单插入的父级元素
                        el: root,
                  })
            */
            const $formCreate = function (rules, opt = {}) {
                return FormCreate.create(rules, opt, this); // this为this.$formCreate调用时所在的vue实例
            };

            bindAttr($formCreate);

            // 添加到Vue原型上
            Vue.prototype.$formCreate = $formCreate;

            Vue.component(formCreateName, get$FormCreate()); //组件使用方式
            _vue = Vue;
        }

        static init(rules, _opt = {}) {
            let $vm = create(rules, _opt), formCreate = $vm.$refs.fc.formCreate;

            return {
                mount($el) {
                    if ($el && isElement($el))
                        formCreate.options.el = $el;
                    formCreate.options.el.appendChild($vm.$el);
                    return formCreate.handle.fCreateApi;
                },
                remove() {
                    formCreate.options.el.removeChild($vm.$el);
                },
                destroy() {
                    this.remove();
                    $vm.$destroy();
                },
                $f: formCreate.handle.fCreateApi
            };
        }
    }

    bindAttr(FormCreate);

    // 注册forma-create内部自定义的组件
    drive.components.forEach(component => {
        FormCreate.component(component.name, component);
    });


    /*
    drive.parsers为
        [
            {
                name:checkbox,
                parser:对应的parser类
            }
            ...
        ]
    */
    drive.parsers.forEach(({name, parser}) => {
        FormCreate.setParser(name, parser);
    });

    Object.keys(drive.makers).forEach(name => {
        FormCreate.maker[name] = drive.makers[name];
    });


    // 导出FormCreate类和install方法
    return {
        FormCreate,
        install
    };
}