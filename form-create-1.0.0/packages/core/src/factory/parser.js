import VData from './vData';
import {toString, uniqueId} from '@form-create/utils';
import VNode from './vNode';


/*
    每个rule都会生成一个parser实例
*/
export default class BaseParser {

    constructor(handle, rule, id) {
        this.rule = rule;   //rule规则
        this.vData = new VData; //创建VNode实例（form-create定义的VNode类，不是Vue的VNode）
        this.vNode = new VNode(); //创建VData实例
        this.id = id; //唯一id
        this.watch = [];
        this.type = toString(rule.type).toLocaleLowerCase(); //rule.type
        this.isDef = true;
        this.el = undefined; //rule渲染出来的表单控件

        //如果没有定义rule.field字段，则自动生成
        if (!rule.field) {
            this.field = '_def_' + uniqueId(); 
            this.isDef = false;
        } else {
            this.field = rule.field;
        }
        this.name = rule.name;
        
        this.unique = 'fc_' + id;
        this.key = 'key_' + id;
        this.refName = '__' + this.field + this.id;
        this.formItemRefName = 'fi' + this.refName;

        this.update(handle);
        this.init();
    }

    // 同一个rule规则用在了不同的form-create组件中，进行更新，重新设置下列属性
    update(handle) {
        this.$handle = handle;  //handler实例
        this.$render = handle.$render; //挂载在handler实例上的Render实例
        this.vm = handle.vm; //form-create组件实例
        this.options = handle.options; // 表单配置项
        this.vNode.setVm(this.vm);
        this.deleted = false;
    }

    init() {
    }

    toFormValue(value) {
        return value
    }

    toValue(formValue) {
        return formValue;
    }
}