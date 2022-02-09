import VData from './vData';
import VNode from './vNode';
import {deepExtend} from '@form-create/utils';


export default class BaseForm {

    constructor(handle) {
        this.$handle = handle; //handle实例
        this.vm = handle.vm; //为form-create组件实例
        this.drive = this.$handle.fc.drive; 
        this.options = handle.options; // 表单配置项
        this.vNode = new VNode(this.vm); //创建VNode实例（form-create定义的VNode类，不是Vue的VNode）
        this.vData = new VData(); //创建VData实例
        this.unique = handle.id;  //唯一id
    }

    init() {
        //render实例
        this.$render = this.$handle.$render;
    }

    /*
        拿到rule.col配置的属性
        比如：rule = {
            type:"input",
            col:{
                span:"12"
            },  
        }
        则该输入框还会包裹一层Col组件
    */ 
    getGetCol(parser) {
        let col = parser.rule.col || {}, mCol = {}, pCol = {};

        if (!this.options.global)
            return col;
        /*
        option.global配置的col属性
        global:{
            *: {
                col:{...}
            }，
            "input": {
                col:{...}
            }
        }
        优先级则是  * > input > rule.col 
        */ 
        if (this.options.global['*']) {
            mCol = this.options.global['*'].col || {};
        }

        if (this.options.global[parser.type]) {
            pCol = this.options.global[parser.type].col || {};
        }
        col = deepExtend(deepExtend(deepExtend({}, mCol), pCol), col);
        return col;
    }

    beforeRender() {

    }

    render() {

    }

    inputVData() {
    }
}
