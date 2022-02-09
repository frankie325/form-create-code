import {
    $del,
    $set, deepExtend,
    errMsg,
    extend,
    isString,
    isUndef,
    isValidChildren,
    isPlainObject,
    toLine,
    toString,
    uniqueId,
    isFunction
} from '@form-create/utils';
import BaseParser from '../factory/parser';
import Render from './render';
import baseApi from './api';
import {enumerable} from './util';


export function getRule(rule) {
    if (isFunction(rule.getRule))
        return rule.getRule();
    else
        return rule;
}

/*
    1.form-create的初始化中，创建了handle实例，一个form-create组件对应一个handle实例
    handle实例对应一个render实例，form实例
    handle实例主要在初始化过程，主要是对rules进行了处理
    注册了api
*/
export default class Handle {

    constructor(fc) { 
        const {vm, rules, options} = fc;

        this.vm = vm; //为form-create组件实例
        this.fc = fc; //fc为FormCreate实例
        this.id = uniqueId(); //生成唯一id
        this.options = options; // 表单配置项

        this.validate = {};
        this.formData = {};

        this.fCreateApi = undefined;

        this.__init(rules);
        this.$form = new fc.drive.formRender(this, this.id); //创建form实例
        this.$render = new Render(this); //创建Render实例

        this.loadRule(this.rules, false);

        this.$render.initOrgChildren();

        this.$form.init();  //添加render实例到form实例中
    }

    // 初始化一些其他属性
    __init(rules) {
        this.fieldList = {};
        this.trueData = {};
        this.parsers = {};
        this.customData = {};
        this.sortList = [];
        this.rules = rules; //表单规则
        this.origin = [...this.rules];
        this.changeStatus = false;
    }

    loadRule(rules, child) {
        // 遍历表单规则
        rules.map((_rule) => {
            /*
                rule.children = [ {...}, children里可以是字符 ]
            */ 
            if (child && isString(_rule)) return;

            // 如果type不存在，报错console.error()返回undefined，下面的filter过滤掉
            if (!_rule.type)
                return console.error('未定义生成规则的 type 字段' + errMsg());

            let parser;

            if (_rule.__fc__) { //如果rule上已经添加了__fc__属性
                parser = _rule.__fc__;
                // 如果parser.vm不等于handle.vm，说明同一个rule规则用在了不同的form-create组件中
                if (parser.vm !== this.vm && !parser.deleted)
                    return console.error(`${_rule.type}规则正在其他的 <form-create> 中使用` + errMsg());
                // 对parser中的一些属性进行更新 
                parser.update(this);
            } else {
                // 为每个表单控件创建parse类
                parser = this.createParser(this.parseRule(_rule));
            }

            let children = parser.rule.children, rule = parser.rule;

            /*
                如果parser.field与handle.parsers中重复了
                说明用户传入的rule.filed起名冲突，报错
            */
            if (!this.notField(parser.field))
                return console.error(`${rule.field} 字段已存在` + errMsg());

            //设置parser，添加到handle.parsers上
            this.setParser(parser);

            if (!_rule.__fc__) {
                // 绑定__field__，__fc__属性
                bindParser(_rule, parser);
            }

            // rule.children必须是数组，则递归调用loadRule
            if (isValidChildren(children)) {
                this.loadRule(children, true);
            }

            // 没有rule.children的，才会将parser.id推入到handle.sortList
            if (!child) {
                this.sortList.push(parser.id);
            }

            // 如果用户定义rule.field字段
            if (!this.isNoVal(parser))

                //拦截rule.value 
                Object.defineProperty(parser.rule, 'value', {
                    get: () => {
                        // 为rule.value值
                        return parser.toValue(this.getFormData(parser));
                    },
                    set: (value) => {
                        // 当rule.value值改变的时候
                        if (this.isChange(parser, value)) {
                            this.$render.clearCache(parser, true);
                            this.setFormData(parser, parser.toFormValue(value)); // 设置rule.value到handle.formData
                        }
                    }
                });

            return parser;
        }).filter(h => h).forEach(h => {
            // 过滤掉无效的rule值，并为每个rule添加root属性，为所有的rule规则
            h.root = rules;
        });
    }

    // 为每个表单控件创建parse类
    createParser(rule) {
        /*
            parsers = {
                checkbox:对应的parser类
            }
        */ 
        const id = this.id + '' + uniqueId(), parsers = this.fc.parsers, type = toString(rule.type).toLocaleLowerCase();

        const Parser = (parsers[type]) ? parsers[type] : BaseParser;

        return new Parser(this, rule, id);
    }

    // 解析每项表单规则
    parseRule(_rule) {
        // def表单规则默认所有的配置属性默认所有的配置，rule为表单规则
        const def = defRule(), rule = getRule(_rule);

        Object.keys(def).forEach(k => {
            // 遍历默认所有的配置，如果在rule中不存在，则将默认值添加到rule中
            if (isUndef(rule[k])) $set(rule, k, def[k]);
        });
        const parseRule = {
            options: parseArray(rule.options) //像Select组件这种，传递options配置
        };

        /*
            处理on选项事件和emit选项注入的事件
            会对事件进行参数的注入
        */ 
        parseRule.on = this.parseOn(rule.on || {}, this.parseEmit(rule));

        // 重新将rule规则中的options和on参数进行响应式处理
        Object.keys(parseRule).forEach(k => {
            $set(rule, k, parseRule[k]);
        });

        // 返回rule规则
        return rule;
    }

    // 处理on选项的事件
    parseOn(on, emit) {
        // options.injectEvent表单配置，为true的话，所有事件都注入参数
        if (this.options.injectEvent)
            Object.keys(on).forEach(k => {
                on[k] = this.inject(on[k]) //inject没考虑到on选项事件为数组的形式，这里会报错，bug
            });
        return parseOn(on, emit);
    }

    // 为事件注入参数
    inject(_fn, inject) {
        if (_fn.__inject) //如果已经注入过了
            _fn = _fn.__origin;

        const h = this;

        const fn = function (...args) {
            const {option, rule} = h.vm.$options.propsData;
            // 注入参数
            args.unshift({
                $f: h.fCreateApi, //api
                rule,   //表单规则
                option, //表单配置
                inject  //注入的数据
            });
            _fn.apply(this, args);
        };
        fn.__inject = true;
        fn.__origin = _fn;
        return fn;
    }

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
    parseEmit(rule) {
        let event = {}, {emit, emitPrefix, field} = rule;

        // 不是数组直接返回
        if (!Array.isArray(emit)) return event;

        // 遍历emit数组配置项
        emit.forEach(config => {
            let inject = {}, eventName = config;

            if (isPlainObject(config)) {//如果是对象

                eventName = config.name; //事件名称
                inject = config.inject || {};
            }
            if (!eventName) return; //如果事件名称不存在，直接返回

            // emitPrefix和eventName拼接，并转为连字符
            const emitKey = emitPrefix ? emitPrefix : field;
            const fieldKey = toLine(`${emitKey}-${eventName}`).replace('_', '-');

            const fn = (...arg) => {
                this.vm.$emit(fieldKey, ...arg);
            };

            fn.__emit = true;
            // options.injectEvent表单配置，为true的话，所有事件都将注入参数
            event[eventName] = (this.options.injectEvent || config.inject !== undefined) ? this.inject(fn, inject) : fn;
        });

        /*  
            // 返回的事件对象
            {
                "change": fn
            }
        */
        return event;
    }

    // from-create组件执行渲染函数时调用
    run() {
        if (this.vm.unique > 0)
            //执行render.run 
            return this.$render.run();
        else {
            this.vm.unique = 1;
            return [];
        }
    }

    setParser(parser) {
        let {id, field, name, rule} = parser; //每个rule都对应一个parser实例
        if (this.parsers[id]) //已经存在，直接返回
            return;

        /*
            添加到handle.parsers上
            handle.parsers = {
                id: parser实例
                ...
            }
        */
        this.parsers[id] = parser;

        // 如果用户没有定义rule.field字段
        if (this.isNoVal(parser)) { 
            /*
            如果存在rule.name，自定义组件才有name属性

            添加到handle.customData上，并进行响应式处理
            handle.customData = {
                name: parser实例
                ...
            }
            */
            if (name)
                $set(this.customData, name, parser);
            return;
        }

        /*
            添加到handle.fieldList上
            handle.fieldList = {
                rule.field: parser实例
                ...
            }
        */
        this.fieldList[field] = parser;
         /*
            添加到handle.formData上，并进行响应式处理
            handle.formData = {
                rule.field: rule.value
                ...
            }
            添加到handle.validate上，并进行响应式处理
            handle.validate = {
                rule.field: rule.validate
                ...
            }

            添加到handle.trueData上，并进行响应式处理
            handle.trueData = {
                rule.field: parser实例
                ...
            }
        */
        $set(this.formData, field, parser.toFormValue(rule.value));
        $set(this.validate, field, rule.validate || []);
        $set(this.trueData, field, parser);
    }

    notField(id) {
        return this.parsers[id] === undefined;
    }

    // 判断是否修改了rule.value
    isChange(parser, value) {
        return JSON.stringify(parser.rule.value) !== JSON.stringify(value);
    }

    onInput(parser, value) {
        // 如果定义了rule.filed字段，value也变了
        if (!this.isNoVal(parser) && this.isChange(parser, parser.toValue(value))) {
            this.$render.clearCache(parser);
            this.setFormData(parser, value); //更新到handle.formData
            this.changeStatus = true;
        }
    }

    getParser(id) {
        if (this.fieldList[id])
            return this.fieldList[id];
        else if (this.customData[id])
            return this.customData[id];
        else if (this.parsers[id])
            return this.parsers[id];
    }

    created() {
        const vm = this.vm;

        // 将表单配置，提交按钮和重置按钮的添加到form-create实例
        vm.$set(vm, 'buttonProps', this.options.submitBtn);
        vm.$set(vm, 'resetProps', this.options.resetBtn);
        // 将formData添加到form-create实例
        vm.$set(vm, 'formData', this.formData);


        // 如果fCreateApi还没定义
        if (this.fCreateApi === undefined)

            //注册基础api和iview包里的api进行合并
            this.fCreateApi = this.fc.drive.getGlobalApi(this, baseApi(this));
        this.fCreateApi.rule = this.rules; // 添加rule属性，为所有rule规则
        this.fCreateApi.config = this.options; // 添加config属性，为表单配置
    }

    // 对rule里面的属性进行监听，排除children属性
    addParserWitch(parser) {
        const vm = this.vm;

        Object.keys(parser.rule).forEach((key) => {
            // 如果rule里面的属性存在于下面列表中，或者没有定义，则直接返回，不进行响应式处理
            if (['field', 'type', 'value', 'vm', 'template', 'name', 'config'].indexOf(key) !== -1 || parser.rule[key] === undefined) return;
            try {
                // 对rule里面的属性进行监听，排除children属性，并将解除监听的方法添加到parser.watch数组中
                parser.watch.push(vm.$watch(() => parser.rule[key], (n, o) => {
                    if (o === undefined) return;  //如果旧的值不存在，直接返回，不用执行下一步的clearCache
                    this.$render.clearCache(parser);
                }, {deep: key !== 'children', immediate: true}));
            } catch (e) {
                //
            }
        });
    }
    
    //主要是对rule进行监听
    mountedParser() {
        const vm = this.vm;
        // 遍历所有parser实例
        Object.keys(this.parsers).forEach((id) => {
            let parser = this.parsers[id]; //拿到rule规则对应的parser实例 
            if (parser.watch.length === 0) this.addParserWitch(parser); //监听rule

            parser.el = vm.$refs[parser.refName] || {}; //parser.el设置为rule渲染出来的表单控件

            if (parser.defaultValue === undefined)
                //parser.defaultValue设置为rule.value的拷贝 
                parser.defaultValue = deepExtend({}, {value: parser.rule.value}).value;

            parser.mounted && parser.mounted(); //执行parser.mounted方法，作者还没定义parser.mounted方法
        });
    }

    // from-create组件执行mounted钩子时执行
    mounted() {
        const mounted = this.options.mounted; //表单配置中传入的mounted函数

        this.mountedParser(); //主要是对rule进行监听

        mounted && mounted(this.fCreateApi); //执行配置中传入的mounted函数，api作为参数
        this.fc.$emit('mounted', this.fCreateApi); //调用FormCreate.$emit方法，会执行form-create组件上绑定的mounted方法
    }

    reload() {
        const onReload = this.options.onReload;

        this.mountedParser();

        onReload && onReload(this.fCreateApi);
        this.fc.$emit('on-reload', this.fCreateApi);
    }

    removeField(parser) {
        const {id, field} = parser, index = this.sortList.indexOf(id);

        delParser(parser);
        $del(this.parsers, id);

        if (index !== -1) {
            this.sortList.splice(index, 1);
        }

        if (!this.fieldList[field]) {
            $del(this.validate, field);
            $del(this.formData, field);
            $del(this.customData, field);
            $del(this.fieldList, field);
            $del(this.trueData, field);
        }
    }

    refresh() {
        this.vm._refresh();
    }

    reloadRule(rules) {
        const vm = this.vm;
        if (!rules) return this.reloadRule(this.rules);
        if (!this.origin.length) this.fCreateApi.refresh();
        this.origin = [...rules];

        const parsers = {...this.parsers};
        this.__init(rules);
        this.loadRule(rules, false);
        Object.keys(parsers).filter(id => this.parsers[id] === undefined)
            .forEach(id => this.removeField(parsers[id]));
        this.$render.initOrgChildren();
        this.created();

        vm.$nextTick(() => {
            this.reload();
        });

        vm.$f = this.fCreateApi;
        this.$render.clearCacheAll();
        this.refresh();
    }

    // 设置rule.value到handle.formData
    setFormData(parser, value) {
        this.formData[parser.field] = value;
    }

    // 返回rule.value
    getFormData(parser) {
        return this.formData[parser.field];
    }

    fields() {
        return Object.keys(this.formData);
    }

    // parser.isDef表示用户是否定义了rule.field字段，函数返回true，则没定义
    isNoVal(parser) {
        return !parser.isDef;
    }

}

export function delParser(parser) {
    parser.watch.forEach((unWatch) => unWatch());
    parser.watch = [];
    parser.deleted = true;
    Object.defineProperty(parser.rule, 'value', {
        value: extend({}, {value: parser.rule.value}).value
    });
}

// 将emit配置项生成的事件合并到on对象中
function parseOn(on, emitEvent) {
    if (Object.keys(emitEvent).length > 0) extend(on, emitEvent);
    return on;
}

// 判断是否为数组，不是数组则返回空数组
function parseArray(validate) {
    return Array.isArray(validate) ? validate : [];
}


// 表单规则所有的配置
function defRule() {
    return {
        validate: [],
        col: {},
        emit: [],
        props: {},
        on: {},
        options: [],
        title: undefined,
        value: '',
        field: '',
        name: undefined,
        className: undefined
    };
}

// 为rule规则添加__field__，和__fc__属性，不可枚举，不可配置
// __field__为rule.field，__fc__为parser实例
function bindParser(rule, parser) {
    Object.defineProperties(rule, {
        __field__: enumerable(parser.field),
        __fc__: enumerable(parser)
    });
}