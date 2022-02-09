import {_vue as Vue} from './index';
import {debounce, errMsg, isString, isUndef, isValidChildren} from '@form-create/utils';
import VNode from '../factory/vNode';
import VData from '../factory/vData';


const $de = debounce((fn) => fn(), 1);

export default class Render {
    constructor(handle) {
        this.$handle = handle; //handle实例
        this.fc = handle.fc; //FormCreate实例
        this.vm = handle.vm; //form-create组件实例
        this.options = handle.options; // 表单配置项
        this.$form = handle.$form; //form实例
        this.vNode = new VNode(this.vm);  //创建VNode实例（form-create定义的VNode类，不是Vue的VNode）
        this.vData = new VData(); //创建VData实例
        this.cache = {};
        this.renderList = {};
    }
    
    // 修改rule里面的值时，会调用该方法
    clearCache(parser, clear = true) {
        if (!this.cache[parser.id]) return;
        if (this.cacheStatus(parser))
            this.$handle.refresh();
        const parent = this.cache[parser.id].parent;
        this.cache[parser.id] = null;
        if (parent && clear)
            this.clearCache(parent, clear);
    }

    clearCacheAll() {
        this.cache = {};
    }

    // 缓存根据rule生成的VNode
    setCache(parser, vnode, parent) {
        this.cache[parser.id] = {
            vnode,
            use: false,
            parent
        };
    }

    cacheStatus(parser) {
        return this.cache[parser.id] && (this.cache[parser.id].use === true || this.cache[parser.id].parent);
    }

    // 有缓存，则直接使用缓存的VNode
    getCache(parser) {
        const cache = this.cache[parser.id];
        cache.use = true;
        return cache.vnode;
    }

    // 创建handle实例时调用
    initOrgChildren() {
        /*
            rule规则如果有children
            添加到render.orgChildren对象中
            {
               parser.id: [ {...}, {...}, "rule.children里可以是字符" ]  //rule.children的rule规则
            }
        */ 
        const parsers = this.$handle.parsers;
        this.orgChildren = Object.keys(parsers).reduce((initial, id) => {
            const children = parsers[id].rule.children; //拿到rule.children
            initial[id] = isValidChildren(children) ? [...children] : []; //添加到initial对象中

            return initial;
        }, {});
    }

    run() {
        if (!this.vm.isShow)
            return;

        this.$form.beforeRender(); //执行form实例的beforeRender方法，生成form-create组件的vData


        // vn伟
        const vn = this.$handle.sortList.map((id) => {
            let parser = this.$handle.parsers[id];//拿到rule对应的parser
            if (parser.type === 'hidden') return; //rule.type为hidden直接返回
            return this.renderParser(parser); //根据所有rule，生成VNode树
        }).filter((val) => val !== undefined);

        return this.$form.render(vn); //生成Form组件的VNode，所有rule的VNode作为子节点
    }

    /*
    options.global设置所有组件的通用规则，
    global:{
        //设置所有组件
        '*':{
          props:{
            disabled:false
          }
        },
        //设置所有input组件
        input:{

        }
    }
    */ 
    setGlobalConfig(parser) {
        if (!this.options.global) return;

        if (this.options.global['*']) {
            //将global中的通用规则，添加到parser.vData._data上
            this.toData(parser, this.options.global['*']);
        }
        if (this.options.global[parser.type]) {
            this.toData(parser, this.options.global[parser.type]);
        }
    }

    /*
        渲染rule.type为template的rule项
        需要传递rule.template = "<div>i am template</div>"属性。
        传递rule.vm，模板组件的 Vue 示例对象，用于解析模板
        比如
        rule = {
            type: "template",
            template: "<div>i am template</div>",
            vm: new Vue({
                propsData:{...},
                data(){
                    return {}
                }
            }),
            value:"",
            props:{ ... } //这里传的props将会覆盖propsData
        }

        renderTemplate得到该模板的VNode
    */
    renderTemplate(parser) {
        const {id, rule, key} = parser;

        // 拿到Vue.compile编译器
        if (Vue.compile === undefined) {
            console.error('使用的 Vue 版本不支持 compile' + errMsg());
            return [];
        }

        if (!this.renderList[id]) {
            if (isUndef(rule.vm)) rule.vm = new Vue; //如果没有定义rule.vm属性
            /*
                调用compile得到渲染函数
                {
                    render:()=>{../}
                    staticRenderFns: [ ()=>{...}, ()=>{...} ],
                }

            */ 
            this.renderList[id] = Vue.compile(rule.template);
        }

        // props合并到propsData中，并设置rule.vm组件的value值为rule.value
        setTemplateProps(parser, this.$handle.fCreateApi);

        rule.vm.$off('input'); //移除input事件
        // 重新设置input事件，修改handle.formData里的值，相当于做了双向数据绑定
        rule.vm.$on('input', (value) => {
            this.onInput(parser, value);
        });

        // 执行该组件的渲染函数，得到VNode
        const vn = this.renderList[id].render.call(rule.vm);

        if (vn.data === undefined) vn.data = {};
        vn.key = key;
        return vn;
    }

    renderParser(parser, parent) {
        parser.vData.get(); //重置VData
        this.setGlobalConfig(parser); //options.global设置所有组件的通用规则，添加到parser.vData._data

        if (!this.cache[parser.id] || parser.type === 'template') { //如果还没有缓存
            let {type, rule} = parser, form = this.$form, vn;

            /*
                如果rule.type是template，
                那么还需要传递rule.template = "<div>i am template</div>"属性。
            */
            if (type === 'template' && rule.template) {
                vn = this.renderTemplate(parser); //得到模板的VNode

                if (parent) { 
                    this.setCache(parser, vn, parent); //缓存VNode
                    return vn;
                }

            // 如果用户定义rule.field属性
            } else if (!this.$handle.isNoVal(parser)) {
                
                const children = this.renderChildren(parser); //调用renderChildren生成子节点VNode
                vn = parser.render ? parser.render(children) : this.defaultRender(parser, children); //调用parser实力的render方法，或者默认的render
            } else {
                // 没有定义rule.field属性，进入这里
                vn = this.vNode.make(type, this.inputVData(parser), this.renderChildren(parser));
                if (parent) {
                    this.setCache(parser, vn, parent); //缓存VNode
                    return vn;
                }
            }
            if (rule.native !== true)  //是否原样生成表单组件，为true则不会生成FormItem进行包裹
                vn = form.container(vn, parser); // 创建FormItem的VNode进行包裹
            this.setCache(parser, vn, parent);  //缓存VNode

            return vn;
        }

        return this.getCache(parser);
    }
    //将global中的通用规则，添加到vData._data上
    toData(parser, data) {
        Object.keys(parser.vData._data).forEach((key) => {
            // 遍历vData._data，如果通用规则的值定义了，则重新赋值
            if (data[key] !== undefined)
                parser.vData[key](data[key]);
        });

        return parser.vData;
    }

    // 调用toData，将rule设置到vData._data上
    parserToData(parser) {
        return this.toData(parser, parser.rule);
    }

    inputVData(parser, custom) {
        const {refName, key} = parser;

        // 将rule中的props，class，style等属性合并到vData._data上
        this.parserToData(parser);

        /*
           下面主要是设置vData._data的一些属性以及数据双向绑定，如下：
            vData._data = {
                key:"fc_itemxxx",
                props:{
                    formCreate: api,
                    value:rule.value,
                    size: medium / small / mini
                },
                on:{
                    input:() => {}
                }
            }
        */
        let data = parser.vData
            .ref(refName).key('fc_item' + key).props('formCreate', this.$handle.fCreateApi);

        if (!custom)
            //双向数据绑定 
            data.on('input', (value) => {
                this.onInput(parser, value);
            }).props('value', this.$handle.getFormData(parser));
        
        // 表单配置option.form.size，添加到表单控件中
        this.$form.inputVData && this.$form.inputVData(parser, custom);

        return data;
    }

    // 调用handle.onInput重新设置handle.formData里的值
    onInput(parser, value) {
        this.$handle.onInput(parser, value);
    }

    renderChildren(parser) {
        /*
            this.orgChildren = {
               parser.id: [ {...}, {...}, "rule.children里可以是字符" ]  //rule.children的rule规则
            }
        */
        const {children} = parser.rule, orgChildren = this.orgChildren[parser.id];

        if (!isValidChildren(children)) {
            // 遍历rule.children
            orgChildren.forEach(child => {
                // 子rule为非字符，且子rule有__fc__，说明之前已经作为rule使用过了（比如新增rule配置，更新了）
                if (!isString(child) && child.__fc__) {
                    this.$handle.removeField(child.__fc__);
                }
            });
            this.orgChildren[parser.id] = [];
            return [];
        }

        // 重新遍历上面修改过的rule.children，如果不存在
        this.orgChildren[parser.id].forEach(child => {
            if (children.indexOf(child) === -1 && !isString(child) && child.__fc__) {
                this.$handle.removeField(child.__fc__);
            }
        });

        // 返回子节点的VNode，[VNode, "字符" , VNode]
        return children.map(child => {
            if (isString(child)) return child;  //如果是字符，原样返回

            if (child.__fc__) {
                // 继续递归调用
                return this.renderParser(child.__fc__, parser);
            }

            $de(() => this.$handle.reloadRule()); 
        });

    }

    defaultRender(parser, children) {
        return this.vNode[parser.type] ? this.vNode[parser.type](this.inputVData(parser), children) : this.vNode.make(parser.type, this.inputVData(parser), children);
    }
}
/*
    rule = {
            type: "template",
            template: "<div>i am template</div>",
            vm: new Vue({
                propsData:{...},
                data(){
                    return {}
                }
            }),
            value:"",
            props:{ ... } //这里传的props将会覆盖propsData
        }
    是可以向rule.vm该组件传递props属性的，通过$props可以访问

    props合并到propsData中，并设置rule.vm组件的value值为rule.value
*/
function setTemplateProps(parser, fApi) {
    const {rule} = parser;
    // $props为vue组件上绑定的属性
    if (!rule.vm.$props)
        return;

    const keys = Object.keys(rule.vm.$props);
    // 遍历组件上的props，如果在rule.props中重复的话会对propsData进行覆盖
    keys.forEach(key => {
        if (rule.props[key] !== undefined)
            rule.vm.$props[key] = rule.props[key];
    });

    // 设置组件的value属性
    if (keys.indexOf('value') !== -1) {
        rule.vm.$props.value = parser.rule.value;
    }
    // 为该组件添加api
    rule.vm.$props.formCreate = fApi;
}