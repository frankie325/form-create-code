import Api from '../frame/api';
import Render from '../render';
import extend from '@form-create/utils/lib/extend';
import {funcProxy} from '../frame/util';
import useInject from './inject';
import usePage from './page';
import useRender from './render';
import useLoader from './loader';
import useInput from './input';
import useContext from './context';
import useLifecycle from './lifecycle';
import useEffect from './effect';


export default function Handler(fc) {
    extend(this, {
        fc, //FormCreate实例
        vm: fc.vm,//form-create组件实例
        watching: false,
        loading: false,
        reloading: false,
        noWatchFn: null,
        deferSyncFn: null,
        isMounted: false,
        formData: {},
        subForm: {},
        form: {},
        appendData: {},
        providers: {},
        cycleLoad: null,
        loadedId: 1,
        nextTick: null,
        changeStatus: false,
        pageEnd: true,
        nextReload: () => {
            this.lifecycle('reload');
        }
    });

    // 对下述对象中的方法进行代理，通过this.options直接访问
    funcProxy(this, {
        options() {
            return fc.options;
        },
        bus() {
            return fc.bus;
        },
    })

    this.initData(fc.rules);

    this.$manager = new fc.manager(this); //创建manager实例
    this.$render = new Render(this); //创建render实例
    this.api = fc.extendApi(Api(this), this); //将iview的api合并到核心api
}

extend(Handler.prototype, {
    // 初始化下列属性
    initData(rules) {
        extend(this, {
            /*
                将RuleContext实例设置到handler.ctxs
                所有rule对应的ctx实例都在这
                ctxs = {
                    id:RuleContext实例
                }
            */ 
            ctxs: {},
            fieldCtx: {},
            nameCtx: {},
            sort: [], //保存rule对应的ctx.id，按顺序排列，children里的rule不会
            rules,
        });
    },
    init() {
        this.appendData = {...this.fc.options.formData || {}, ...this.vm.value || {}, ...this.appendData};
        this.useProvider(); //处理自定义属性
        this.usePage(); //设置分页
        this.loadRule();//处理rules
        this.$manager.__init();
        this.vm.$set(this.vm, 'formData', this.formData); //设置formData
    },
})

useInject(Handler);
usePage(Handler);
useRender(Handler);
useLoader(Handler);
useInput(Handler);
useContext(Handler);
useLifecycle(Handler);
useEffect(Handler);
