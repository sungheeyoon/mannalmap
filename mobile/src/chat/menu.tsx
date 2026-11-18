import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Dimensions, Pressable, StyleSheet } from 'react-native';

import { iconButtonFace, type IconButtonVariant } from '@/ui/buttons';
import { MenuPanel } from '@/ui/surfaces';
import { Icon, type IconName } from '@/ui/icons';
import { Scrim } from '@/ui/scrim';
import { COLOR, CONTROL, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { WordText } from '@/ui/word-text';


/** `icon` 을 안 주면 글자만 선다 — 홈 내 사주 카드의 메뉴 */
export type MenuItem = { readonly label: string; readonly icon?: IconName; readonly danger?: boolean; readonly onPress: () => void };

/**
 * 「⋯」 같은 작은 판 — 누른 자리 곁에 서고, 바깥을 누르거나 뒤로 가면 닫힌다. 고르면 먼저 닫고 그 일을 한다. 화면 읽기에는 메뉴와 그 항목으로 읽힌다.
 * `face` 를 주면 여는 단추가 그 아이콘 단추의 면(웹 `ICON_BUTTON_*`)을 입는다 — 홈 내 사주 카드의 `quiet`
 */
export function AnchoredMenu({ label, items, above = false, face, children }: { label: string; items: readonly MenuItem[]; above?: boolean; face?: IconButtonVariant; children: ReactNode }) {
  const anchor = useRef<ComponentRef<typeof Pressable>>(null);
  const [place, setPlace] = useState<{ right: number; top?: number; bottom?: number } | null>(null);

  const open = () => {
    anchor.current?.measureInWindow((x, y, width, height) => {
      const window = Dimensions.get('window');
      const right = Math.max(8, window.width - x - width);
      setPlace(above ? { right, bottom: window.height - y + 4 } : { right, top: y + height + 4 });
    });
  };

  return (
    <>
      <Pressable ref={anchor} accessibilityRole="button" accessibilityLabel={label} onPress={open} style={face === undefined ? styles.anchor : iconButtonFace(face)}>
        {children}
      </Pressable>
      <Scrim open={place !== null} place="free" animation="none" tint={false} onRequestClose={() => setPlace(null)} onOutside={() => setPlace(null)} outsideLabel="닫기">
        {place !== null && (
          <MenuPanel accessibilityRole="menu" style={[styles.panel, place]}>
            {items.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="menuitem"
                style={styles.item}
                onPress={() => {
                  setPlace(null);
                  item.onPress();
                }}
              >
                {item.icon !== undefined && <Icon name={item.icon} color={item.danger === true ? COLOR.danger : COLOR.foreground} size={18} />}
                <WordText style={[styles.itemText, item.danger === true && styles.danger]}>{item.label}</WordText>
              </Pressable>
            ))}
          </MenuPanel>
        )}
      </Scrim>
    </>
  );
}

const styles = StyleSheet.create({
  anchor: { minHeight: CONTROL, minWidth: CONTROL, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill },
  panel: { position: 'absolute', width: 192, padding: 6 },
  item: { minHeight: CONTROL, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  itemText: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  danger: { color: COLOR.danger },
});
