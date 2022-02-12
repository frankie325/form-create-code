import extend from '@form-create/utils/lib/extend';
import is from '@form-create/utils/lib/type';
import {invoke} from '../frame/util';


export default function useLifecycle(Handler) {
    extend(Handler.prototype, {
        mounted() {
            const _mounted = () => {
                this.isMounted = true;
                this.lifecycle('mounted');
            }
            if (this.pageEnd) {
                _mounted();
            } else {
                this.bus.$once('page-end', _mounted);
            }
        },
        lifecycle(name) {
            const fn = this.options[name]; //name="mounted"是，拿到option.mounted
            is.Function(fn) && invoke(() => fn(this.api)); //执行mounted并传入api作为第一个参数
            this.vm.$emit(name, this.api); //触发form-create组件上绑定的方法
        },
    })
}
